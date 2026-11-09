package com.impactmapper.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.stmt.IfStmt;
import com.github.javaparser.ast.type.ClassOrInterfaceType;
import com.impactmapper.entity.ArchitectureEdge;
import com.impactmapper.entity.ArchitectureNode;
import com.impactmapper.entity.ArchitectureSnapshot;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class JavaSourceAnalysisService {

    private final JavaParser javaParser;

    public JavaSourceAnalysisService() {
        ParserConfiguration config = new ParserConfiguration();
        config.setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_17);
        this.javaParser = new JavaParser(config);
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    public static class AnalysisResult {
        public final List<ArchitectureNode> nodes = new ArrayList<>();
        public final List<ArchitectureEdge> edges = new ArrayList<>();
    }

    public AnalysisResult analyzeJavaFile(String filePath, String content, ArchitectureSnapshot snapshot) {
        AnalysisResult result = new AnalysisResult();

        if (content == null || content.isBlank()) {
            return result;
        }

        CompilationUnit cu;
        try {
            ParseResult<CompilationUnit> parseResult = javaParser.parse(content);
            if (!parseResult.isSuccessful() || parseResult.getResult().isEmpty()) {
                log.warn("Malformed Java source in {}. Skipping file-level AST.", filePath);
                return result;
            }
            cu = parseResult.getResult().get();
        } catch (Exception e) {
            log.warn("Malformed Java source in {}: {}. Skipping file-level AST.", filePath, e.getMessage());
            return result;
        }

        String packageName = cu.getPackageDeclaration()
                .map(pd -> pd.getNameAsString())
                .orElse("default");

        // Package Node
        String packageKey = "pkg:" + packageName;
        result.nodes.add(ArchitectureNode.builder()
                .snapshot(snapshot)
                .nodeKey(packageKey)
                .name(packageName)
                .nodeType("PACKAGE")
                .packageOrModule(packageName)
                .filePath(filePath)
                .evidenceConfidence("DIRECTLY_DETECTED")
                .level(1)
                .build());

        // Imports mapping (SimpleName -> FullQualifiedName)
        Map<String, String> importMap = new HashMap<>();
        List<String> importNames = new ArrayList<>();
        cu.getImports().forEach(imp -> {
            String qName = imp.getNameAsString();
            importNames.add(qName);
            int lastDot = qName.lastIndexOf('.');
            if (lastDot != -1) {
                importMap.put(qName.substring(lastDot + 1), qName);
            } else {
                importMap.put(qName, qName);
            }
        });

        Set<String> fileClassNames = cu.getTypes().stream()
                .map(TypeDeclaration::getNameAsString)
                .collect(Collectors.toSet());

        for (TypeDeclaration<?> type : cu.getTypes()) {
            analyzeTypeDeclaration(type, packageName, filePath, packageKey, importNames, importMap, fileClassNames, snapshot, result);
        }

        return result;
    }

    private void analyzeTypeDeclaration(TypeDeclaration<?> type, String packageName, String filePath,
                                       String packageKey, List<String> imports, Map<String, String> importMap,
                                       Set<String> fileClassNames,
                                       ArchitectureSnapshot snapshot, AnalysisResult result) {
        String simpleName = type.getNameAsString();
        String qualifiedName = packageName.equals("default") ? simpleName : (packageName + "." + simpleName);
        String classKey = "class:" + qualifiedName;

        List<String> annotations = type.getAnnotations().stream()
                .map(AnnotationExpr::getNameAsString)
                .collect(Collectors.toList());

        String annotationsJson = "[]";
        try {
            annotationsJson = objectMapper.writeValueAsString(annotations);
        } catch (Exception ignored) {}

        int startLine = type.getRange().map(r -> r.begin.line).orElse(1);
        int endLine = type.getRange().map(r -> r.end.line).orElse(startLine);

        // Class-level RequestMapping prefix(es)
        List<String> classRoutePrefixes = new ArrayList<>();
        for (AnnotationExpr an : type.getAnnotations()) {
            if ("RequestMapping".equals(an.getNameAsString())) {
                List<String> rawPaths = extractAnnotationPaths(an);
                for (String p : rawPaths) {
                    if (p != null && !p.isBlank() && !p.equals("/")) {
                        String prefix = p.startsWith("/") ? p : ("/" + p);
                        if (prefix.endsWith("/")) {
                            prefix = prefix.substring(0, prefix.length() - 1);
                        }
                        classRoutePrefixes.add(prefix);
                    }
                }
            }
        }
        if (classRoutePrefixes.isEmpty()) {
            classRoutePrefixes.add("");
        }

        // Determine specific component type
        String nodeType = "CLASS";
        if (type instanceof ClassOrInterfaceDeclaration) {
            ClassOrInterfaceDeclaration cid = (ClassOrInterfaceDeclaration) type;
            if (cid.isInterface()) {
                nodeType = "INTERFACE";
            } else if (cid.isAbstract()) {
                nodeType = "ABSTRACT_CLASS";
            }
        } else if (type instanceof EnumDeclaration) {
            nodeType = "ENUM";
        } else if (type instanceof RecordDeclaration) {
            nodeType = "RECORD";
        }

        // Spring Role Detection
        boolean hasMappingMethods = false;
        if (type instanceof ClassOrInterfaceDeclaration cdecl) {
            hasMappingMethods = cdecl.getMethods().stream()
                    .anyMatch(m -> m.getAnnotations().stream().anyMatch(a -> a.getNameAsString().endsWith("Mapping")));
        }

        boolean isController = annotations.stream().anyMatch(a -> a.endsWith("Controller") || a.endsWith("RestController") || a.endsWith("RequestMapping"))
                || hasMappingMethods;
        boolean isService = annotations.stream().anyMatch(a -> a.endsWith("Service"));
        boolean isRepo = annotations.stream().anyMatch(a -> a.endsWith("Repository"));
        boolean isEntity = annotations.stream().anyMatch(a -> a.endsWith("Entity") || a.endsWith("Table") || a.endsWith("Document"));

        if (isController) nodeType = "CONTROLLER";
        else if (isService) nodeType = "SERVICE";
        else if (isRepo) nodeType = "REPOSITORY";
        else if (isEntity) nodeType = "ENTITY";

        result.nodes.add(ArchitectureNode.builder()
                .snapshot(snapshot)
                .nodeKey(classKey)
                .name(simpleName)
                .nodeType(nodeType)
                .filePath(filePath)
                .packageOrModule(packageName)
                .annotationsJson(annotationsJson)
                .startLine(startLine)
                .endLine(endLine)
                .evidenceConfidence("DIRECTLY_DETECTED")
                .level(2)
                .build());

        // Package CONTAINS Class
        result.edges.add(ArchitectureEdge.builder()
                .snapshot(snapshot)
                .sourceNodeKey(packageKey)
                .targetNodeKey(classKey)
                .relationshipType("CONTAINS")
                .evidence("Package declaration: " + packageName)
                .evidenceLevel("DIRECTLY_DETECTED")
                .build());

        // Extract Fields (Injected dependencies)
        Map<String, String> fieldTypes = new HashMap<>(); // fieldName -> simpleTypeName
        for (FieldDeclaration field : type.getFields()) {
            String typeName = field.getElementType().asString();
            for (VariableDeclarator var : field.getVariables()) {
                String fieldName = var.getNameAsString();
                fieldTypes.put(fieldName, typeName);

                // If type is imported or same package, record DEPENDS_ON relationship
                String targetQualified = resolveQualifiedType(typeName, packageName, importMap);
                if (targetQualified != null) {
                    result.edges.add(ArchitectureEdge.builder()
                            .snapshot(snapshot)
                            .sourceNodeKey(classKey)
                            .targetNodeKey("class:" + targetQualified)
                            .relationshipType("DEPENDS_ON")
                            .evidence("Field injection: " + typeName + " " + fieldName)
                            .evidenceLevel("DIRECTLY_DETECTED")
                            .build());
                }
            }
        }

        // Check implements & extends
        if (type instanceof ClassOrInterfaceDeclaration cid) {
            for (ClassOrInterfaceType implemented : cid.getImplementedTypes()) {
                String ifaceName = implemented.getNameAsString();
                String ifaceQualified = resolveQualifiedType(ifaceName, packageName, importMap);
                String ifaceKey = "class:" + (ifaceQualified != null ? ifaceQualified : (packageName + "." + ifaceName));
                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(classKey)
                        .targetNodeKey(ifaceKey)
                        .relationshipType("IMPLEMENTS")
                        .evidence("Implements interface " + ifaceName)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());
            }

            for (ClassOrInterfaceType extended : cid.getExtendedTypes()) {
                String superName = extended.getNameAsString();
                String superQualified = resolveQualifiedType(superName, packageName, importMap);
                String superKey = "class:" + (superQualified != null ? superQualified : (packageName + "." + superName));
                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(classKey)
                        .targetNodeKey(superKey)
                        .relationshipType("EXTENDS")
                        .evidence("Extends superclass " + superName)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());
            }
        }

        // Entity PERSISTS_TO relationship
        if (isEntity) {
            String tableName = simpleName.toLowerCase() + "s";
            for (AnnotationExpr an : type.getAnnotations()) {
                if ("Table".equals(an.getNameAsString()) && an instanceof NormalAnnotationExpr nae) {
                    for (MemberValuePair pair : nae.getPairs()) {
                        if ("name".equals(pair.getNameAsString())) {
                            tableName = pair.getValue().toString().replaceAll("\"", "");
                        }
                    }
                }
            }
            String tableKey = "db:table:" + tableName;
            result.nodes.add(ArchitectureNode.builder()
                    .snapshot(snapshot)
                    .nodeKey(tableKey)
                    .name("Table: " + tableName)
                    .nodeType("DATABASE_TABLE")
                    .packageOrModule("Database")
                    .evidenceConfidence("DIRECTLY_DETECTED")
                    .level(2)
                    .build());

            result.edges.add(ArchitectureEdge.builder()
                    .snapshot(snapshot)
                    .sourceNodeKey(classKey)
                    .targetNodeKey(tableKey)
                    .relationshipType("PERSISTS_TO")
                    .evidence("JPA Entity mapped to table @" + tableName)
                    .evidenceLevel("DIRECTLY_DETECTED")
                    .build());
        }

        // Analyze Methods & Method Calls
        Set<String> declaredMethodNames = type.getMethods().stream()
                .map(MethodDeclaration::getNameAsString)
                .collect(Collectors.toSet());

        boolean hasClassAuth = type.getAnnotations().stream().anyMatch(a -> a.getNameAsString().contains("PreAuthorize") || a.getNameAsString().contains("Secured"));

        for (MethodDeclaration method : type.getMethods()) {
            analyzeMethod(method, classKey, simpleName, packageName, filePath, classRoutePrefixes, isController, hasClassAuth,
                    fieldTypes, importMap, declaredMethodNames, fileClassNames, snapshot, result);
        }

        // Connect relevant imports
        for (String imp : imports) {
            if (imp.startsWith("java.") || imp.startsWith("javax.")) continue;
            String importKey = "pkg:" + imp;
            result.edges.add(ArchitectureEdge.builder()
                    .snapshot(snapshot)
                    .sourceNodeKey(classKey)
                    .targetNodeKey(importKey)
                    .relationshipType("IMPORTS")
                    .evidence("Import: " + imp)
                    .evidenceLevel("DIRECTLY_DETECTED")
                    .build());
        }
    }

    private void analyzeMethod(MethodDeclaration method, String classKey, String className, String packageName,
                               String filePath, List<String> classRoutePrefixes, boolean isController, boolean hasClassAuth,
                               Map<String, String> fieldTypes,
                               Map<String, String> importMap, Set<String> declaredMethodNames, Set<String> fileClassNames,
                               ArchitectureSnapshot snapshot, AnalysisResult result) {
        String methodName = method.getNameAsString();
        String methodKey = classKey + "#" + methodName;
        int mStart = method.getRange().map(r -> r.begin.line).orElse(1);
        int mEnd = method.getRange().map(r -> r.end.line).orElse(mStart);

        // Create Method Node
        String methodSignature = method.getDeclarationAsString(false, false, false);
        result.nodes.add(ArchitectureNode.builder()
                .snapshot(snapshot)
                .nodeKey(methodKey)
                .name(methodName)
                .nodeType("METHOD")
                .packageOrModule(className)
                .filePath(filePath)
                .annotationsJson(methodSignature)
                .startLine(mStart)
                .endLine(mEnd)
                .evidenceConfidence("DIRECTLY_DETECTED")
                .level(3)
                .build());

        // Class CONTAINS Method
        result.edges.add(ArchitectureEdge.builder()
                .snapshot(snapshot)
                .sourceNodeKey(classKey)
                .targetNodeKey(methodKey)
                .relationshipType("CONTAINS")
                .evidence("Declared method: " + methodSignature)
                .evidenceLevel("DIRECTLY_DETECTED")
                .build());

        // Check for EventListener annotation
        boolean isEventListener = method.getAnnotations().stream()
                .anyMatch(a -> a.getNameAsString().equals("EventListener"));
        if (isEventListener) {
            String eventParam = method.getParameters().isEmpty() ? "Object" : method.getParameter(0).getTypeAsString();
            result.edges.add(ArchitectureEdge.builder()
                    .snapshot(snapshot)
                    .sourceNodeKey(methodKey)
                    .targetNodeKey("event:listener:" + eventParam)
                    .relationshipType("EVENT_CONSUME")
                    .evidence("EventListener for " + eventParam + " at line " + mStart)
                    .evidenceLevel("DIRECTLY_DETECTED")
                    .build());
        }

        // Check for REST endpoint mapping
        List<String> methodPaths = new ArrayList<>();
        String httpMethod = null;

        for (AnnotationExpr an : method.getAnnotations()) {
            String anName = an.getNameAsString();
            if (anName.endsWith("Mapping")) {
                if (anName.equals("GetMapping")) httpMethod = "GET";
                else if (anName.equals("PostMapping")) httpMethod = "POST";
                else if (anName.equals("PutMapping")) httpMethod = "PUT";
                else if (anName.equals("DeleteMapping")) httpMethod = "DELETE";
                else if (anName.equals("PatchMapping")) httpMethod = "PATCH";
                else if (anName.equals("RequestMapping")) {
                    httpMethod = "GET";
                    if (an instanceof NormalAnnotationExpr nae) {
                        for (MemberValuePair pair : nae.getPairs()) {
                            if ("method".equals(pair.getNameAsString())) {
                                String mStr = pair.getValue().toString().toUpperCase();
                                if (mStr.contains("POST")) httpMethod = "POST";
                                else if (mStr.contains("PUT")) httpMethod = "PUT";
                                else if (mStr.contains("DELETE")) httpMethod = "DELETE";
                                else if (mStr.contains("PATCH")) httpMethod = "PATCH";
                                else if (mStr.contains("GET")) httpMethod = "GET";
                            }
                        }
                    }
                }

                methodPaths.addAll(extractAnnotationPaths(an));
                break;
            }
        }

        if ((isController || httpMethod != null) && httpMethod != null && !methodPaths.isEmpty()) {
            List<Map<String, Object>> parameters = new ArrayList<>();
            String requestBodyType = null;
            for (Parameter p : method.getParameters()) {
                Map<String, Object> paramMap = new HashMap<>();
                paramMap.put("name", p.getNameAsString());
                paramMap.put("type", p.getTypeAsString());
                String in = "query";
                boolean isReq = true;
                for (AnnotationExpr pAn : p.getAnnotations()) {
                    String pAnName = pAn.getNameAsString();
                    if ("PathVariable".equals(pAnName)) in = "path";
                    else if ("RequestBody".equals(pAnName)) {
                        in = "body";
                        requestBodyType = p.getTypeAsString();
                    } else if ("RequestHeader".equals(pAnName)) in = "header";
                    else if ("RequestParam".equals(pAnName)) {
                        in = "query";
                        if (pAn.toString().contains("required = false") || pAn.toString().contains("required=false")) {
                            isReq = false;
                        }
                    }
                }
                paramMap.put("in", in);
                paramMap.put("required", isReq);
                parameters.add(paramMap);
            }

            String returnType = method.getTypeAsString();

            String authClassification = "AUTHENTICATED";
            boolean hasPreAuth = hasClassAuth || method.getAnnotations().stream().anyMatch(a -> a.getNameAsString().contains("PreAuthorize") || a.getNameAsString().contains("Secured"));

            if (hasPreAuth) {
                authClassification = "ROLE_PROTECTED";
            }

            Map<String, Object> meta = new HashMap<>();
            meta.put("parameters", parameters);
            meta.put("requestBodyType", requestBodyType);
            meta.put("responseType", returnType);
            meta.put("authClassification", authClassification);
            String metadataJson = null;
            try {
                metadataJson = objectMapper.writeValueAsString(meta);
            } catch (Exception ignored) {}

            for (String prefix : classRoutePrefixes) {
                for (String mPath : methodPaths) {
                    String fullRoute = combineRoutes(prefix, mPath);
                    String endpointKey = "endpoint:" + httpMethod + ":" + fullRoute;
                    String endpointName = httpMethod + " " + fullRoute;

                    result.nodes.add(ArchitectureNode.builder()
                            .snapshot(snapshot)
                            .nodeKey(endpointKey)
                            .name(endpointName)
                            .nodeType("API_ENDPOINT")
                            .packageOrModule(className)
                            .filePath(filePath)
                            .annotationsJson(metadataJson)
                            .evidenceConfidence("DIRECTLY_DETECTED")
                            .level(3)
                            .startLine(mStart)
                            .endLine(mEnd)
                            .build());

                    result.edges.add(ArchitectureEdge.builder()
                            .snapshot(snapshot)
                            .sourceNodeKey(classKey)
                            .targetNodeKey(endpointKey)
                            .relationshipType("EXPOSES")
                            .evidence("REST handler @" + httpMethod + "Mapping(" + fullRoute + ") in " + methodName)
                            .evidenceLevel("DIRECTLY_DETECTED")
                            .build());

                    result.edges.add(ArchitectureEdge.builder()
                            .snapshot(snapshot)
                            .sourceNodeKey(methodKey)
                            .targetNodeKey(endpointKey)
                            .relationshipType("HANDLES")
                            .evidence("Method handles route " + endpointName)
                            .evidenceLevel("DIRECTLY_DETECTED")
                            .build());
                }
            }
        }

        // Method Calls Extraction inside method body
        method.findAll(MethodCallExpr.class).forEach(call -> {
            String scope = call.getScope().map(Expression::toString).orElse("");
            String calledName = call.getNameAsString();
            int callLine = call.getRange().map(r -> r.begin.line).orElse(mStart);

            // Check for conditional branch
            String branchCondition = call.findAncestor(IfStmt.class)
                    .map(ifStmt -> ifStmt.getCondition().toString())
                    .orElse(null);

            // Case A: Event publisher invocation
            if ("publishEvent".equals(calledName) || scope.toLowerCase().contains("eventpublisher") || "applicationEventPublisher".equalsIgnoreCase(scope)) {
                String argType = call.getArguments().isEmpty() ? "Event" : call.getArgument(0).toString();
                String callEvidence = "Event publication: publishEvent(" + argType + ") at line " + callLine
                        + (branchCondition != null ? " [if (" + branchCondition + ")]" : "");

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(methodKey)
                        .targetNodeKey("event:publisher#" + calledName)
                        .relationshipType("EVENT_PUBLISH")
                        .evidence(callEvidence)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());
                return;
            }

            // Case B: Internal call in same class (this.helper() or helper())
            if ((scope.isEmpty() || "this".equals(scope)) && declaredMethodNames.contains(calledName)) {
                String targetMethodKey = classKey + "#" + calledName;
                String callEvidence = "Internal call: " + calledName + "() at line " + callLine
                        + (branchCondition != null ? " [if (" + branchCondition + ")]" : "");

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(methodKey)
                        .targetNodeKey(targetMethodKey)
                        .relationshipType("CALLS")
                        .evidence(callEvidence)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());
                return;
            }

            // Case C: Call to another class in same file
            if (fileClassNames.contains(scope)) {
                String targetQualified = packageName.equals("default") ? scope : (packageName + "." + scope);
                String targetClassKey = "class:" + targetQualified;
                String targetMethodKey = targetClassKey + "#" + calledName;

                String callEvidence = "Same-file class call: " + scope + "." + calledName + "() at line " + callLine
                        + (branchCondition != null ? " [if (" + branchCondition + ")]" : "");

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(classKey)
                        .targetNodeKey(targetClassKey)
                        .relationshipType("CALLS")
                        .evidence(callEvidence)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(methodKey)
                        .targetNodeKey(targetMethodKey)
                        .relationshipType("CALLS")
                        .evidence(callEvidence)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());
                return;
            }

            // Case D: Call on an injected field (e.g. orderService.create(...))
            String fieldType = fieldTypes.get(scope);
            if (fieldType != null) {
                String targetQualified = resolveQualifiedType(fieldType, packageName, importMap);
                String targetClassKey = "class:" + (targetQualified != null ? targetQualified : (packageName + "." + fieldType));
                String targetMethodKey = targetClassKey + "#" + calledName;

                boolean isRepoCall = fieldType.endsWith("Repository") || fieldType.endsWith("Dao");
                String callEvidence = (isRepoCall ? "Repository invocation: " : "Invokes ")
                        + scope + "." + calledName + "() at line " + callLine
                        + (branchCondition != null ? " [if (" + branchCondition + ")]" : "");

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(classKey)
                        .targetNodeKey(targetClassKey)
                        .relationshipType("CALLS")
                        .evidence(callEvidence)
                        .evidenceLevel("STATIC_INFERENCE")
                        .build());

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(methodKey)
                        .targetNodeKey(targetMethodKey)
                        .relationshipType("CALLS")
                        .evidence(callEvidence)
                        .evidenceLevel("STATIC_INFERENCE")
                        .build());
            }
        });

        // Extract Exception throw statements inside method body
        method.findAll(com.github.javaparser.ast.stmt.ThrowStmt.class).forEach(throwStmt -> {
            int tLine = throwStmt.getRange().map(r -> r.begin.line).orElse(mStart);
            String branchCondition = throwStmt.findAncestor(IfStmt.class)
                    .map(ifStmt -> ifStmt.getCondition().toString())
                    .orElse(null);

            String exprStr = throwStmt.getExpression().toString();
            String excEvidence = "Throws " + exprStr + " at line " + tLine
                    + (branchCondition != null ? " [if (" + branchCondition + ")]" : "");

            result.edges.add(ArchitectureEdge.builder()
                    .snapshot(snapshot)
                    .sourceNodeKey(methodKey)
                    .targetNodeKey("exception:" + exprStr.replaceAll("\\s+", "_"))
                    .relationshipType("EXCEPTION")
                    .evidence(excEvidence)
                    .evidenceLevel("DIRECTLY_DETECTED")
                    .build());
        });
    }

    private String combineRoutes(String prefix, String path) {
        if (prefix == null) prefix = "";
        if (path == null || path.isBlank()) path = "/";
        if (!path.startsWith("/")) path = "/" + path;

        String combined = prefix + path;
        if (combined.isEmpty()) return "/";
        if (combined.length() > 1 && combined.endsWith("/")) {
            combined = combined.substring(0, combined.length() - 1);
        }
        return combined;
    }

    private String resolveQualifiedType(String typeName, String currentPackage, Map<String, String> importMap) {
        if (typeName == null || typeName.isBlank()) return null;
        // Strip generics if present: e.g. List<Order> -> List
        int genericIdx = typeName.indexOf('<');
        if (genericIdx != -1) {
            typeName = typeName.substring(0, genericIdx).trim();
        }

        if (importMap.containsKey(typeName)) {
            return importMap.get(typeName);
        }
        // Assume same package
        return currentPackage.equals("default") ? typeName : (currentPackage + "." + typeName);
    }

    private String extractAnnotationPath(AnnotationExpr an) {
        List<String> paths = extractAnnotationPaths(an);
        return paths.isEmpty() ? "/" : paths.get(0);
    }

    private List<String> extractAnnotationPaths(AnnotationExpr an) {
        List<String> paths = new ArrayList<>();
        if (an instanceof SingleMemberAnnotationExpr smae) {
            extractPathsFromExpr(smae.getMemberValue(), paths);
        } else if (an instanceof NormalAnnotationExpr nae) {
            for (MemberValuePair pair : nae.getPairs()) {
                if ("value".equals(pair.getNameAsString()) || "path".equals(pair.getNameAsString())) {
                    extractPathsFromExpr(pair.getValue(), paths);
                }
            }
        }
        if (paths.isEmpty()) {
            paths.add("/");
        }
        return paths;
    }

    private void extractPathsFromExpr(Expression expr, List<String> paths) {
        if (expr instanceof ArrayInitializerExpr aie) {
            for (Expression v : aie.getValues()) {
                String s = v.toString().replace("\"", "").trim();
                if (!s.isBlank()) paths.add(s);
            }
        } else if (expr != null) {
            String s = expr.toString().replace("\"", "").trim();
            if (s.startsWith("{") && s.endsWith("}")) {
                s = s.substring(1, s.length() - 1);
                for (String part : s.split(",")) {
                    String clean = part.replace("\"", "").trim();
                    if (!clean.isBlank()) paths.add(clean);
                }
            } else if (!s.isBlank()) {
                paths.add(s);
            }
        }
    }

    private AnalysisResult createMalformedJavaFallback(String filePath, String content, ArchitectureSnapshot snapshot) {
        AnalysisResult res = new AnalysisResult();
        int lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        String fileName = lastSlash != -1 ? filePath.substring(lastSlash + 1) : filePath;
        String simpleName = fileName.replace(".java", "");
        String folder = lastSlash != -1 ? filePath.substring(0, lastSlash) : "root";
        String pkg = folder.replace('/', '.');
        int lineCount = content.split("\r\n|\r|\n").length;

        ArchitectureNode node = ArchitectureNode.builder()
                .snapshot(snapshot)
                .nodeKey("class:" + (pkg.isEmpty() ? simpleName : (pkg + "." + simpleName)))
                .name(simpleName)
                .nodeType("MALFORMED_JAVA")
                .filePath(filePath)
                .packageOrModule(pkg)
                .level(2)
                .startLine(1)
                .endLine(lineCount)
                .evidenceConfidence("SYNTAX_ERROR")
                .build();
        res.nodes.add(node);
        return res;
    }
}
