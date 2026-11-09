package com.impactmapper.service;

import com.impactmapper.entity.ArchitectureEdge;
import com.impactmapper.entity.ArchitectureNode;
import com.impactmapper.entity.ArchitectureSnapshot;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class JavaScriptSourceAnalysisService {

    public JavaSourceAnalysisService.AnalysisResult analyzeJsFile(String filePath, String content, ArchitectureSnapshot snapshot) {
        JavaSourceAnalysisService.AnalysisResult result = new JavaSourceAnalysisService.AnalysisResult();

        if (content == null || content.isBlank()) {
            return result;
        }

        String moduleName = filePath;
        int lastSlash = filePath.lastIndexOf('/');
        if (lastSlash >= 0) {
            moduleName = filePath.substring(lastSlash + 1);
        }

        String fileKey = "file:" + filePath;
        String dirPath = lastSlash >= 0 ? filePath.substring(0, lastSlash) : "root";
        String dirKey = "dir:" + dirPath;

        // Directory Node
        result.nodes.add(ArchitectureNode.builder()
                .snapshot(snapshot)
                .nodeKey(dirKey)
                .name(dirPath)
                .nodeType("DIRECTORY")
                .packageOrModule(dirPath)
                .filePath(dirPath)
                .evidenceConfidence("DIRECTLY_DETECTED")
                .level(1)
                .build());

        // File/Module Node
        result.nodes.add(ArchitectureNode.builder()
                .snapshot(snapshot)
                .nodeKey(fileKey)
                .name(moduleName)
                .nodeType("MODULE")
                .packageOrModule(dirPath)
                .filePath(filePath)
                .evidenceConfidence("DIRECTLY_DETECTED")
                .level(2)
                .build());

        result.edges.add(ArchitectureEdge.builder()
                .snapshot(snapshot)
                .sourceNodeKey(dirKey)
                .targetNodeKey(fileKey)
                .relationshipType("CONTAINS")
                .evidence("Filesystem hierarchy: " + filePath)
                .evidenceLevel("DIRECTLY_DETECTED")
                .build());

        String[] lines = content.split("\\r?\\n");

        // Patterns
        Pattern importFromPattern = Pattern.compile("(?:import\\s+.*?from\\s+['\"]([^'\"]+)['\"]|require\\(['\"]([^'\"]+)['\"]\\))");
        Pattern classPattern = Pattern.compile("(?:export\\s+)?class\\s+([A-Za-z0-9_]+)(?:\\s+extends\\s+([A-Za-z0-9_]+))?");
        Pattern functionPattern = Pattern.compile("(?:export\\s+)?(?:async\\s+)?function\\s+([A-Za-z0-9_]+)");
        Pattern routePattern = Pattern.compile("(?:\\b(?:app|router|server|api|fastify|[A-Za-z0-9_]*Router|[A-Za-z0-9_]*Routes))\\.(get|post|put|delete|patch)\\s*\\(\\s*['\"`]([^'\"`]+)['\"`]");

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            int lineNum = i + 1;

            // Imports
            Matcher importMatcher = importFromPattern.matcher(line);
            if (importMatcher.find()) {
                String pkg = importMatcher.group(1) != null ? importMatcher.group(1) : importMatcher.group(2);
                if (pkg != null && !pkg.isBlank()) {
                    String depKey = "dep:" + pkg;
                    result.edges.add(ArchitectureEdge.builder()
                            .snapshot(snapshot)
                            .sourceNodeKey(fileKey)
                            .targetNodeKey(depKey)
                            .relationshipType("IMPORTS")
                            .evidence("Import at line " + lineNum + ": " + pkg)
                            .evidenceLevel("DIRECTLY_DETECTED")
                            .build());
                }
            }

            // Classes
            Matcher classMatcher = classPattern.matcher(line);
            if (classMatcher.find()) {
                String className = classMatcher.group(1);
                String superClass = classMatcher.group(2);
                String classKey = "class:" + filePath + "#" + className;

                result.nodes.add(ArchitectureNode.builder()
                        .snapshot(snapshot)
                        .nodeKey(classKey)
                        .name(className)
                        .nodeType("CLASS")
                        .filePath(filePath)
                        .packageOrModule(dirPath)
                        .startLine(lineNum)
                        .endLine(lineNum)
                        .evidenceConfidence("DIRECTLY_DETECTED")
                        .level(2)
                        .build());

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(fileKey)
                        .targetNodeKey(classKey)
                        .relationshipType("DECLARES")
                        .evidence("Class declaration at line " + lineNum)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());

                if (superClass != null) {
                    result.edges.add(ArchitectureEdge.builder()
                            .snapshot(snapshot)
                            .sourceNodeKey(classKey)
                            .targetNodeKey("class:" + superClass)
                            .relationshipType("EXTENDS")
                            .evidence("Extends " + superClass + " at line " + lineNum)
                            .evidenceLevel("STATIC_INFERENCE")
                            .build());
                }
            }

            // Routes / Endpoints
            Matcher routeMatcher = routePattern.matcher(line);
            if (routeMatcher.find()) {
                String method = routeMatcher.group(1).toUpperCase();
                String routePath = routeMatcher.group(2);
                String endpointKey = "endpoint:" + method + ":" + routePath;

                result.nodes.add(ArchitectureNode.builder()
                        .snapshot(snapshot)
                        .nodeKey(endpointKey)
                        .name(method + " " + routePath)
                        .nodeType("API_ENDPOINT")
                        .filePath(filePath)
                        .packageOrModule(dirPath)
                        .startLine(lineNum)
                        .endLine(lineNum)
                        .evidenceConfidence("DIRECTLY_DETECTED")
                        .level(3)
                        .build());

                result.edges.add(ArchitectureEdge.builder()
                        .snapshot(snapshot)
                        .sourceNodeKey(fileKey)
                        .targetNodeKey(endpointKey)
                        .relationshipType("EXPOSES")
                        .evidence("Route handler at line " + lineNum + ": " + method + " " + routePath)
                        .evidenceLevel("DIRECTLY_DETECTED")
                        .build());
            }
        }

        return result;
    }
}

