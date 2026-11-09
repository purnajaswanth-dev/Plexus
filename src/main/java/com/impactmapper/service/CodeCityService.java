package com.impactmapper.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.impactmapper.dto.codecity.*;
import com.impactmapper.dto.codecity.ArchitectureIntelligenceDTO;
import com.impactmapper.entity.*;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class CodeCityService {

    private final RepositoryRepository repositoryRepository;
    private final ArchitectureSnapshotRepository snapshotRepository;
    private final ArchitectureNodeRepository nodeRepository;
    private final ArchitectureEdgeRepository edgeRepository;
    private final CodeEndpointRepository endpointRepository;
    private final StaticExecutionPathRepository executionPathRepository;
    private final RuntimeTraceRepository runtimeTraceRepository;
    private final CityLayoutRepository cityLayoutRepository;
    private final GitHubService gitHubService;
    private final org.springframework.beans.factory.ObjectProvider<ArchitectureAnalysisService> architectureAnalysisServiceProvider;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, CityModelDTO> cityModelCache = Collections.synchronizedMap(
            new LinkedHashMap<Long, CityModelDTO>(8, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<Long, CityModelDTO> eldest) {
                    return size() > 3;
                }
            }
    );
    private final Map<Long, ArchitectureIntelligenceDTO> intelligenceCache = Collections.synchronizedMap(
            new LinkedHashMap<Long, ArchitectureIntelligenceDTO>(8, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<Long, ArchitectureIntelligenceDTO> eldest) {
                    return size() > 3;
                }
            }
    );

    public static String cleanComponentName(String raw) {
        if (raw == null || raw.isBlank())
            return "Unknown";
        String s = raw.trim();
        if (s.startsWith("class:"))
            s = s.substring(6);
        else if (s.startsWith("repo:"))
            s = s.substring(5);
        else if (s.startsWith("endpoint:"))
            s = s.substring(9);
        else if (s.startsWith("file:"))
            s = s.substring(5);
        else if (s.startsWith("dir:"))
            s = s.substring(4);

        if (s.contains("#"))
            s = s.substring(0, s.indexOf('#'));

        boolean isFilePath = false;
        int lastSlash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (lastSlash != -1 && lastSlash < s.length() - 1) {
            s = s.substring(lastSlash + 1);
            isFilePath = true;
        }

        String lower = s.toLowerCase();
        for (String ext : List.of(".java", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".json", ".py", ".go", ".html", ".css")) {
            if (lower.endsWith(ext)) {
                s = s.substring(0, s.length() - ext.length());
                isFilePath = true;
                break;
            }
        }

        if (!isFilePath) {
            int lastDot = s.lastIndexOf('.');
            if (lastDot != -1 && lastDot < s.length() - 1) {
                return s.substring(lastDot + 1);
            }
        }
        return s;
    }

    public CityModelDTO syncCityModel(com.impactmapper.entity.Repository repo, ArchitectureSnapshot snapshot) {
        log.info("Generating deterministic CodeCity model for repository {} (snapshot {})...", repo.getRepoName(),
                snapshot.getId());

        List<ArchitectureNode> allNodes = nodeRepository.findBySnapshotId(snapshot.getId());
        List<ArchitectureEdge> allEdges = edgeRepository.findBySnapshotId(snapshot.getId());

        // 1. Discover and persist endpoints and execution paths in isolated transaction
        persistEndpointsAndPaths(repo, snapshot, allNodes, allEdges);

        // 2. Compute deterministic 2D spatial layout derived strictly from repository content
        CityModelDTO cityModel = computeSpatialLayout(repo, snapshot, allNodes, allEdges);
        cityModelCache.put(snapshot.getId(), cityModel);
        intelligenceCache.remove(snapshot.getId());

        // 3. Persist layout cache
        persistCityLayoutCache(snapshot, cityModel);

        return cityModel;
    }

    @Transactional
    public void persistEndpointsAndPaths(com.impactmapper.entity.Repository repo, ArchitectureSnapshot snapshot,
            List<ArchitectureNode> allNodes, List<ArchitectureEdge> allEdges) {
        // Clean up previous paths and endpoints in correct FK order
        try {
            List<StaticExecutionPath> oldPaths = executionPathRepository.findBySnapshotId(snapshot.getId());
            if (oldPaths != null && !oldPaths.isEmpty()) {
                executionPathRepository.deleteAll(oldPaths);
                executionPathRepository.flush();
            }
            List<CodeEndpoint> oldEndpoints = endpointRepository.findBySnapshotIdOrderByRoutePathAsc(snapshot.getId());
            if (oldEndpoints != null && !oldEndpoints.isEmpty()) {
                endpointRepository.deleteAll(oldEndpoints);
                endpointRepository.flush();
            }
        } catch (Exception e) {
            log.warn("Error cleaning up old paths/endpoints for snapshot {}: {}", snapshot.getId(), e.getMessage());
        }

        // Discover and persist endpoints
        syncEndpoints(repo, snapshot, allNodes, allEdges);

        // Discover and persist static execution paths
        syncExecutionPaths(snapshot, allNodes, allEdges);
    }

    @Transactional
    public void persistCityLayoutCache(ArchitectureSnapshot snapshot, CityModelDTO cityModel) {
        try {
            cityLayoutRepository.deleteBySnapshotId(snapshot.getId());
            CityLayout layout = CityLayout.builder()
                    .snapshot(snapshot)
                    .layoutAlgorithm("METROPOLIS_URBAN_PLANNING_V3")
                    .cityWidth(cityModel.getCityWidth())
                    .cityHeight(cityModel.getCityHeight())
                    .districtsJson(objectMapper.writeValueAsString(cityModel.getDistricts()))
                    .buildingsJson(objectMapper.writeValueAsString(cityModel.getBuildings()))
                    .roadsJson(objectMapper.writeValueAsString(cityModel.getRoads()))
                    .calculatedAt(LocalDateTime.now())
                    .build();
            cityLayoutRepository.save(layout);
        } catch (Exception e) {
            log.warn("Failed to serialize city layout cache: {}", e.getMessage());
        }
    }

    private void syncEndpoints(com.impactmapper.entity.Repository repo, ArchitectureSnapshot snapshot,
            List<ArchitectureNode> nodes, List<ArchitectureEdge> edges) {
        List<ArchitectureNode> endpointNodes = nodes.stream()
                .filter(n -> "API_ENDPOINT".equalsIgnoreCase(n.getNodeType()))
                .collect(Collectors.toList());

        Set<String> seenEndpoints = new HashSet<>();
        List<CodeEndpoint> endpointsToSave = new ArrayList<>();

        for (ArchitectureNode epNode : endpointNodes) {
            String name = epNode.getName();
            String httpMethod = "GET";
            String routePath = "/";

            int firstSpace = name.indexOf(' ');
            if (firstSpace != -1) {
                httpMethod = name.substring(0, firstSpace).trim();
                routePath = name.substring(firstSpace + 1).trim();
            }

            String epIdentity = httpMethod + ":" + routePath;
            if (seenEndpoints.contains(epIdentity)) {
                continue;
            }
            seenEndpoints.add(epIdentity);

            String controllerClass = epNode.getPackageOrModule() != null ? epNode.getPackageOrModule() : "Controller";
            String handlerMethod = "handleRequest";
            String sourceFile = epNode.getFilePath();
            Integer startLine = epNode.getStartLine();
            Integer endLine = epNode.getEndLine();
            String paramsJson = null;
            String requestBodyType = null;
            String responseType = null;
            String authClassification = "AUTHENTICATED";
            if (routePath.contains("/login") || routePath.contains("/signup") || routePath.contains("/register")
                    || routePath.contains("/public")) {
                authClassification = "PERMIT_ALL";
            }

            if (epNode.getAnnotationsJson() != null && !epNode.getAnnotationsJson().isBlank()) {
                try {
                    Map<String, Object> meta = objectMapper.readValue(epNode.getAnnotationsJson(),
                            new TypeReference<>() {
                            });
                    if (meta.containsKey("parameters")) {
                        paramsJson = objectMapper.writeValueAsString(meta.get("parameters"));
                    }
                    if (meta.containsKey("requestBodyType")) {
                        requestBodyType = (String) meta.get("requestBodyType");
                    }
                    if (meta.containsKey("responseType")) {
                        responseType = (String) meta.get("responseType");
                    }
                    if (meta.containsKey("authClassification")) {
                        authClassification = (String) meta.get("authClassification");
                    }
                } catch (Exception ignored) {
                }
            }

            for (ArchitectureEdge edge : edges) {
                if (edge.getTargetNodeKey().equals(epNode.getNodeKey())
                        && "EXPOSES".equalsIgnoreCase(edge.getRelationshipType())) {
                    String ctrlKey = edge.getSourceNodeKey();
                    for (ArchitectureNode n : nodes) {
                        if (n.getNodeKey().equals(ctrlKey)) {
                            controllerClass = cleanComponentName(n.getName());
                            if (sourceFile == null)
                                sourceFile = n.getFilePath();
                            break;
                        }
                    }
                }
                if (edge.getTargetNodeKey().equals(epNode.getNodeKey())
                        && "HANDLES".equalsIgnoreCase(edge.getRelationshipType())) {
                    String mKey = edge.getSourceNodeKey();
                    int hashIdx = mKey.indexOf('#');
                    if (hashIdx != -1) {
                        handlerMethod = mKey.substring(hashIdx + 1);
                    }
                }
            }

            CodeEndpoint ep = CodeEndpoint.builder()
                    .repository(repo)
                    .snapshot(snapshot)
                    .httpMethod(httpMethod)
                    .routePath(routePath)
                    .controllerClass(controllerClass)
                    .handlerMethod(handlerMethod)
                    .sourceFile(sourceFile)
                    .startLine(startLine)
                    .endLine(endLine)
                    .parametersJson(paramsJson)
                    .requestBodyType(requestBodyType)
                    .responseType(responseType)
                    .authClassification(authClassification)
                    .apiCategory("REST")
                    .analysisStatus("COMPLETE")
                    .nodeKey(epNode.getNodeKey())
                    .build();

            endpointsToSave.add(ep);
        }

        if (!endpointsToSave.isEmpty()) {
            endpointRepository.saveAllAndFlush(endpointsToSave);
        }
    }

    private void syncExecutionPaths(ArchitectureSnapshot snapshot, List<ArchitectureNode> nodes,
            List<ArchitectureEdge> edges) {
        List<CodeEndpoint> endpoints = endpointRepository.findBySnapshotIdOrderByRoutePathAsc(snapshot.getId());
        List<StaticExecutionPath> pathsToSave = new ArrayList<>();

        for (CodeEndpoint ep : endpoints) {
            String ctrlTargetKey = "class:" + ep.getControllerClass();
            for (ArchitectureNode n : nodes) {
                if (n.getNodeKey().equals(ep.getNodeKey())
                        || (ep.getSourceFile() != null && ep.getSourceFile().equals(n.getFilePath()))
                        || n.getName().equalsIgnoreCase(ep.getControllerClass())
                        || cleanComponentName(n.getName()).equalsIgnoreCase(ep.getControllerClass())) {
                    ctrlTargetKey = n.getNodeKey();
                    break;
                }
            }

            List<StaticExecutionStep> steps = new ArrayList<>();
            steps.add(StaticExecutionStep.builder()
                    .stepIndex(1)
                    .sourceComponentKey(ep.getNodeKey())
                    .sourceComponentName(ep.getHttpMethod() + " " + ep.getRoutePath())
                    .targetComponentKey(ctrlTargetKey)
                    .targetComponentName(ep.getControllerClass())
                    .sourceMethod("HTTP " + ep.getHttpMethod() + " Request")
                    .targetMethod(ep.getHandlerMethod())
                    .callExpression("HTTP " + ep.getHttpMethod() + " " + ep.getRoutePath() + " -> "
                            + ep.getControllerClass() + "." + ep.getHandlerMethod() + "()")
                    .relationshipType("ENTRY_POINT")
                    .isResolved(true)
                    .build());

            int stepCounter = 2;
            String ctrlClass = ep.getControllerClass();
            boolean validCtrlClass = ctrlClass != null && ctrlClass.trim().length() >= 3
                    && !"Root".equalsIgnoreCase(ctrlClass.trim())
                    && !"Controller".equalsIgnoreCase(ctrlClass.trim())
                    && !"src".equalsIgnoreCase(ctrlClass.trim());

            if (validCtrlClass) {
                for (ArchitectureEdge edge : edges) {
                    if (steps.size() >= 20) break;
                    if (edge.getSourceNodeKey().contains(ctrlClass)
                            && ("CALLS".equalsIgnoreCase(edge.getRelationshipType())
                                    || "PERSISTS_TO".equalsIgnoreCase(edge.getRelationshipType()))) {
                        String targetKey = edge.getTargetNodeKey();
                        String tClass = targetKey.contains("#") ? targetKey.substring(0, targetKey.indexOf('#'))
                                : targetKey;
                        String evidence = edge.getEvidence() != null ? edge.getEvidence() : "Method call";
                        String branchCond = null;
                        if (evidence.contains("[if (")) {
                            int s = evidence.indexOf("[if (") + 5;
                            int e = evidence.indexOf(")]", s);
                            if (e != -1)
                                branchCond = evidence.substring(s, e);
                        }
                        steps.add(StaticExecutionStep.builder()
                                .stepIndex(stepCounter++)
                                .sourceComponentKey("class:" + ctrlClass)
                                .sourceComponentName(ctrlClass)
                                .targetComponentKey(tClass)
                                .targetComponentName(cleanComponentName(tClass))
                                .callExpression(evidence)
                                .relationshipType(edge.getRelationshipType())
                                .branchCondition(branchCond)
                                .evidence(evidence)
                                .isResolved(true)
                                .build());
                    }
                }
            }

            StaticExecutionPath path = StaticExecutionPath.builder()
                    .endpoint(ep)
                    .snapshot(snapshot)
                    .totalSteps(steps.size())
                    .inferredSummary(steps.stream().map(StaticExecutionStep::getTargetComponentName)
                            .filter(Objects::nonNull).collect(Collectors.joining(" → ")))
                    .hasAlternativeBranches(steps.stream().anyMatch(s -> s.getBranchCondition() != null))
                    .createdAt(LocalDateTime.now())
                    .build();

            for (StaticExecutionStep s : steps) {
                s.setPath(path);
            }
            path.setSteps(steps);
            pathsToSave.add(path);
        }

        if (!pathsToSave.isEmpty()) {
            executionPathRepository.saveAllAndFlush(pathsToSave);
        }
    }

    /**
     * Computes a deterministic 2D spatial layout derived strictly from repository
     * content.
     * Top-level packages/modules become Districts. Folders become neighborhoods.
     * Real source files (keyed by full repo-relative filePath) become Buildings.
     * Declared types become Rooms, and declared methods become Workstations.
     * Roads are generated ONLY from resolved call edges between files.
     */

    private static class DistrictDraft {
        String key;
        String name;
        String distId;
        double width;
        double height;
        int layer;
        String[] palette;
        int fileCount;
        int numNeighbourhoods;
        List<CityBlockDTO> blocks;
        List<CityBuildingDTO> buildings;
        List<CityStreetDTO> localStreets;

        DistrictDraft(String key, String name, String distId, double width, double height, int layer,
                String[] palette, int fileCount, int numNeighbourhoods,
                List<CityBlockDTO> blocks, List<CityBuildingDTO> buildings, List<CityStreetDTO> localStreets) {
            this.key = key;
            this.name = name;
            this.distId = distId;
            this.width = width;
            this.height = height;
            this.layer = layer;
            this.palette = palette;
            this.fileCount = fileCount;
            this.numNeighbourhoods = numNeighbourhoods;
            this.blocks = blocks;
            this.buildings = buildings;
            this.localStreets = localStreets;
        }
    }

    private CityModelDTO computeSpatialLayout(com.impactmapper.entity.Repository repo, ArchitectureSnapshot snapshot,
            List<ArchitectureNode> allNodes, List<ArchitectureEdge> allEdges) {
        // Filter Level 2 source components (Classes, Interfaces, Enums, Records,
        // Modules)
        List<ArchitectureNode> typeNodes = allNodes.stream()
                .filter(n -> n.getLevel() != null && n.getLevel() == 2 && !n.getNodeKey().startsWith("repo:")
                        && !"API_ENDPOINT".equalsIgnoreCase(n.getNodeType()))
                .collect(Collectors.toList());

        if (typeNodes.isEmpty()) {
            typeNodes = allNodes.stream()
                    .filter(n -> !n.getNodeKey().startsWith("repo:")
                            && !"API_ENDPOINT".equalsIgnoreCase(n.getNodeType())
                            && (n.getLevel() == null || n.getLevel() <= 2))
                    .collect(Collectors.toList());
        }

        // Methods grouped by class key
        Map<String, List<ArchitectureNode>> methodsByClass = allNodes.stream()
                .filter(n -> "METHOD".equalsIgnoreCase(n.getNodeType()))
                .collect(Collectors.groupingBy(m -> {
                    String k = m.getNodeKey();
                    int hash = k.indexOf('#');
                    return hash != -1 ? k.substring(0, hash) : k;
                }));

        // Group type nodes by file path (Building = one real file)
        Map<String, List<ArchitectureNode>> typesByFile = new LinkedHashMap<>();
        for (ArchitectureNode tNode : typeNodes) {
            String fPath = tNode.getFilePath();
            if (fPath == null || fPath.isBlank()) {
                fPath = "src/main/java/"
                        + (tNode.getPackageOrModule() != null ? tNode.getPackageOrModule().replace('.', '/') + "/" : "")
                        + tNode.getName() + ".java";
            }
            typesByFile.computeIfAbsent(fPath, k -> new ArrayList<>()).add(tNode);
        }

        // Group files into Districts based on top-level package or module directory
        Map<String, List<String>> filesByDistrict = new LinkedHashMap<>();
        for (String filePath : typesByFile.keySet()) {
            List<ArchitectureNode> fileTypes = typesByFile.get(filePath);
            if (fileTypes == null || fileTypes.isEmpty()) continue;
            ArchitectureNode primaryType = fileTypes.get(0);
            String pkg = primaryType.getPackageOrModule();

            String districtKey = extractDistrictKey(filePath, pkg);
            filesByDistrict.computeIfAbsent(districtKey, k -> new ArrayList<>()).add(filePath);
        }

        // Sort districts deterministically (by call connectivity layer, then name,
        // breaking ties with snapshot id hash)
        long seed = snapshot.getId() != null ? snapshot.getId() : 1L;
        List<String> sortedDistrictKeys = new ArrayList<>(filesByDistrict.keySet());
        sortedDistrictKeys.sort((d1, d2) -> {
            int layer1 = determineDistrictLayer(d1, filesByDistrict.get(d1), typesByFile);
            int layer2 = determineDistrictLayer(d2, filesByDistrict.get(d2), typesByFile);
            if (layer1 != layer2)
                return Integer.compare(layer1, layer2);
            int cmp = d1.compareToIgnoreCase(d2);
            if (cmp != 0)
                return cmp;
            return Long.compare((d1.hashCode() ^ seed), (d2.hashCode() ^ seed));
        });

        // Layer grouping for layered spatial layout
        Map<Integer, List<String>> districtsByLayer = new TreeMap<>();
        for (String dKey : sortedDistrictKeys) {
            int layer = determineDistrictLayer(dKey, filesByDistrict.get(dKey), typesByFile);
            districtsByLayer.computeIfAbsent(layer, k -> new ArrayList<>()).add(dKey);
        }

        List<CityDistrictDTO> districts = new ArrayList<>();
        List<CityBlockDTO> blocks = new ArrayList<>();
        List<CityStreetDTO> streets = new ArrayList<>();
        List<CityIntersectionDTO> intersections = new ArrayList<>();
        List<CityBuildingDTO> buildings = new ArrayList<>();
        Map<String, CityBuildingDTO> buildingByFile = new HashMap<>();

        // --- PHASE A: Pre-calculate internal relative dimensions for each district ---
        List<DistrictDraft> districtDrafts = new ArrayList<>();
        int blockCounter = 1;
        int streetCounter = 1;

        for (String dKey : sortedDistrictKeys) {
            List<String> filePaths = filesByDistrict.get(dKey);
            int fileCount = filePaths.size();

            // Group files within district into semantic neighbourhoods
            Map<String, List<String>> filesByNeighbourhood = new LinkedHashMap<>();
            for (String fPath : filePaths) {
                List<ArchitectureNode> fileTypes = typesByFile.get(fPath);
                ArchitectureNode primary = fileTypes != null && !fileTypes.isEmpty() ? fileTypes.get(0) : null;
                String nKey = extractNeighbourhoodKey(fPath, primary);
                filesByNeighbourhood.computeIfAbsent(nKey, k -> new ArrayList<>()).add(fPath);
            }

            int numNeighbourhoods = filesByNeighbourhood.size();
            int nColsInDist = numNeighbourhoods >= 4 ? 2 : 1;

            Map<String, double[]> nSizes = new HashMap<>();
            double maxColWidth = 0.0;
            for (Map.Entry<String, List<String>> ne : filesByNeighbourhood.entrySet()) {
                int nFiles = ne.getValue().size();
                int bCols = Math.max(1, Math.min(3, (int) Math.ceil(Math.sqrt(nFiles))));
                int bRows = Math.max(1, (int) Math.ceil((double) nFiles / bCols));
                double slotW = 126.0;
                double slotH = 92.0;
                double nW = Math.max(180.0, 24.0 * 2 + bCols * slotW + (bCols - 1) * 16.0);
                double nH = 34.0 + bRows * slotH + (bRows - 1) * 16.0 + 16.0;
                nSizes.put(ne.getKey(), new double[] { nW, nH, bCols, bRows, slotW, slotH });
                maxColWidth = Math.max(maxColWidth, nW);
            }

            double dPadX = 24.0;
            double dPadTop = 52.0;
            double dPadBottom = 24.0;
            double dWidth = (nColsInDist == 1)
                    ? Math.max(280.0, maxColWidth + dPadX * 2)
                    : Math.max(560.0, maxColWidth * 2 + dPadX * 2 + 24.0);

            double[] colY = new double[nColsInDist];
            Arrays.fill(colY, dPadTop);

            int nIdx = 0;
            List<CityBlockDTO> distBlocks = new ArrayList<>();
            Map<String, CityBlockDTO> blockByName = new HashMap<>();

            for (Map.Entry<String, List<String>> ne : filesByNeighbourhood.entrySet()) {
                String nKey = ne.getKey();
                List<String> nFiles = ne.getValue();
                double[] dims = nSizes.get(nKey);
                int assignedCol = nIdx % nColsInDist;

                double blkX = dPadX + (assignedCol * (maxColWidth + 24.0));
                double blkY = colY[assignedCol];
                double blkW = maxColWidth;
                double blkH = dims[1];

                String distId = "dist_" + dKey.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase();
                String blkId = "blk_" + (blockCounter++);
                CityBlockDTO blk = CityBlockDTO.builder()
                        .id(blkId)
                        .districtId(distId)
                        .name(nKey)
                        .packageName(dKey)
                        .folderPath(dKey.replace('.', '/'))
                        .x(blkX)
                        .y(blkY)
                        .width(blkW)
                        .height(blkH)
                        .surfaceColor("#0c111d")
                        .curbColor("#1e293b")
                        .plotCount(nFiles.size())
                        .buildingIds(new ArrayList<>())
                        .build();

                distBlocks.add(blk);
                blockByName.put(nKey, blk);

                colY[assignedCol] += blkH + 20.0;
                nIdx++;
            }

            double maxSubColY = Arrays.stream(colY).max().orElse(dPadTop + 150.0);
            double dHeight = Math.max(180.0, maxSubColY + dPadBottom);

            String districtName = formatDistrictName(dKey);
            String[] palette = getDistrictPalette(dKey, filePaths, typesByFile);
            String distId = "dist_" + dKey.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase();

            List<CityBuildingDTO> distBuildings = new ArrayList<>();
            List<CityStreetDTO> distLocalStreets = new ArrayList<>();

            for (Map.Entry<String, List<String>> ne : filesByNeighbourhood.entrySet()) {
                String nKey = ne.getKey();
                List<String> nPaths = ne.getValue();
                CityBlockDTO targetBlock = blockByName.get(nKey);
                double[] dims = nSizes.get(nKey);
                int bCols = (int) dims[2];
                double slotW = dims[4];
                double slotH = dims[5];

                double bPadX = 24.0;
                double bPadTop = 34.0;
                double bGap = 16.0;

                for (int bi = 0; bi < nPaths.size(); bi++) {
                    String fPath = nPaths.get(bi);
                    List<ArchitectureNode> fileTypes = typesByFile.get(fPath);
                    if (fileTypes == null || fileTypes.isEmpty()) continue;
                    ArchitectureNode primaryType = fileTypes.get(0);

                    int row = bi / bCols;
                    int col = bi % bCols;

                    double bx = targetBlock.getX() + bPadX + col * (slotW + bGap);
                    double by = targetBlock.getY() + bPadTop + row * (slotH + bGap);
                    double bWidth = slotW;
                    double bHeight = slotH;

                    int totalLoc = fileTypes.stream()
                            .mapToInt(t -> (t.getEndLine() != null && t.getStartLine() != null)
                                    ? Math.max(1, t.getEndLine() - t.getStartLine())
                                    : 50)
                            .sum();

                    int totalMethods = fileTypes.stream()
                            .mapToInt(t -> methodsByClass.getOrDefault(t.getNodeKey(), Collections.emptyList()).size())
                            .sum();

                    int floorCount = Math.max(1, Math.min(10, (totalLoc / 40) + 1));
                    String fileName = fPath.substring(Math.max(0, fPath.lastIndexOf('/') + 1));
                    String folderPath = fPath.contains("/") ? fPath.substring(0, fPath.lastIndexOf('/')) : "";

                    boolean isTest = fileName.toLowerCase().contains("test") || fileName.toLowerCase().contains("spec")
                            || fPath.toLowerCase().contains("/test/");
                    String langChip = fileName.endsWith(".java") ? "JAVA"
                            : (fileName.endsWith(".js") ? "JS" : (fileName.endsWith(".ts") ? "TS" : "TXT"));
                    String roleChip = primaryType.getNodeType() != null ? primaryType.getNodeType() : "CLASS";

                    String cleanName = primaryType.getName();
                    if (cleanName.contains(".")) {
                        cleanName = cleanName.substring(cleanName.lastIndexOf('.') + 1);
                    }

                    String gapStatus = "VERIFIED";
                    String gapReason = null;
                    if (fileName.endsWith(".yml") || fileName.endsWith(".yaml") || fileName.endsWith(".properties")) {
                        gapStatus = "UNSUPPORTED";
                        gapReason = "Declarative configuration without AST declaration model";
                    }

                    boolean hasAnyEdge = allEdges.stream()
                            .anyMatch(e -> e.getSourceNodeKey().equals(primaryType.getNodeKey()) ||
                                    e.getTargetNodeKey().equals(primaryType.getNodeKey()));
                    if (!hasAnyEdge && "VERIFIED".equals(gapStatus)) {
                        gapStatus = "NO_RELATIONSHIP";
                        gapReason = "No relationship detected";
                    }

                    String footprintShape = determineFootprintShape(primaryType.getNodeType(), totalLoc, totalMethods);
                    String roofStyle = determineRoofStyle(primaryType.getNodeType(), floorCount);

                    List<String> entryPoints = new ArrayList<>();
                    for (ArchitectureEdge e : allEdges) {
                        if ("EXPOSES".equalsIgnoreCase(e.getRelationshipType())) {
                            if (e.getSourceNodeKey().equals(primaryType.getNodeKey())) {
                                String epKey = e.getTargetNodeKey();
                                String epName = epKey.startsWith("endpoint:") ? epKey.substring(9) : epKey;
                                ArchitectureNode epNode = allNodes.stream()
                                        .filter(n -> n.getNodeKey().equals(epKey))
                                        .findFirst().orElse(null);
                                if (epNode != null && epNode.getName() != null) {
                                    epName = epNode.getName();
                                }
                                entryPoints.add(epName);
                            } else if (e.getTargetNodeKey().equals(primaryType.getNodeKey())) {
                                String epKey = e.getSourceNodeKey();
                                String epName = epKey.startsWith("endpoint:") ? epKey.substring(9) : epKey;
                                entryPoints.add(epName);
                            }
                        }
                    }

                    List<String> allMethodNames = new ArrayList<>();
                    List<CityRoomDTO> rooms = new ArrayList<>();
                    double roomPad = 6.0;
                    double roomHeaderH = 14.0;
                    double rAvailW = bWidth - roomPad * 2;
                    double rAvailH = bHeight - roomHeaderH - roomPad * 2;

                    for (int ti = 0; ti < fileTypes.size(); ti++) {
                        ArchitectureNode tNode = fileTypes.get(ti);
                        List<ArchitectureNode> mNodes = methodsByClass.getOrDefault(tNode.getNodeKey(),
                                Collections.emptyList());
                        List<CityWorkstationDTO> workstations = new ArrayList<>();
                        for (ArchitectureNode m : mNodes) {
                            allMethodNames.add(m.getName());
                            boolean isCtor = m.getName().equalsIgnoreCase(tNode.getName());
                            workstations.add(CityWorkstationDTO.builder()
                                    .id(m.getNodeKey())
                                    .name(m.getName())
                                    .signature(m.getAnnotationsJson())
                                    .startLine(m.getStartLine())
                                    .endLine(m.getEndLine())
                                    .isConstructor(isCtor)
                                    .build());
                        }

                        boolean isIface = "INTERFACE".equalsIgnoreCase(tNode.getNodeType());
                        boolean isAbs = "ABSTRACT_CLASS".equalsIgnoreCase(tNode.getNodeType())
                                || (tNode.getAnnotationsJson() != null
                                        && tNode.getAnnotationsJson().contains("abstract"));

                        rooms.add(CityRoomDTO.builder()
                                .id(tNode.getNodeKey())
                                .name(tNode.getName())
                                .qualifiedName(tNode.getPackageOrModule() != null
                                        ? tNode.getPackageOrModule() + "." + tNode.getName()
                                        : tNode.getName())
                                .isInterface(isIface)
                                .isAbstract(isAbs)
                                .cabinetCount(Math.max(1, Math.min(4, (totalLoc / 60) + 1)))
                                .workstations(workstations)
                                .build());
                    }

                    if (!rooms.isEmpty()) {
                        int numRooms = rooms.size();
                        double singleRoomW = (rAvailW - (numRooms - 1) * 4.0) / numRooms;
                        for (int ri = 0; ri < numRooms; ri++) {
                            CityRoomDTO room = rooms.get(ri);
                            double rx = bx + roomPad + ri * (singleRoomW + 4.0);
                            double ry = by + roomHeaderH + roomPad;
                            room.setX(rx);
                            room.setY(ry);
                            room.setWidth(singleRoomW);
                            room.setHeight(rAvailH);

                            List<CityWorkstationDTO> wsList = room.getWorkstations();
                            int wsCount = wsList.size();
                            int wsCols = Math.max(1, Math.min(3, (int) Math.ceil(Math.sqrt(wsCount))));
                            for (int wi = 0; wi < wsCount; wi++) {
                                CityWorkstationDTO ws = wsList.get(wi);
                                int wr = wi / wsCols;
                                int wc = wi % wsCols;
                                ws.setX(rx + 4.0 + wc * 34.0);
                                ws.setY(ry + 14.0 + wr * 22.0);
                            }
                        }
                    }

                    targetBlock.getBuildingIds().add(primaryType.getNodeKey());

                    CityBuildingDTO bldg = CityBuildingDTO.builder()
                            .id(primaryType.getNodeKey())
                            .fileId(fPath)
                            .name(cleanName)
                            .districtId(distId)
                            .districtName(districtName)
                            .componentType(primaryType.getNodeType())
                            .filePath(fPath)
                            .packageName(primaryType.getPackageOrModule())
                            .fileName(fileName)
                            .folderPath(folderPath)
                            .silhouetteType(determineSilhouetteType(primaryType.getNodeType()))
                            .footprintShape(footprintShape)
                            .roofStyle(roofStyle)
                            .blockId(targetBlock.getId())
                            .orientation("SOUTH")
                            .analysisStatus("VERIFIED")
                            .streetAddress(fileName + " on " + districtName + " Blvd")
                            .roofColor(palette[0])
                            .facadeColor("#192030")
                            .windowColor(palette[0])
                            .entranceX(bx + bWidth / 2.0)
                            .entranceY(by + bHeight)
                            .startLine(primaryType.getStartLine())
                            .endLine(primaryType.getEndLine())
                            .lineCount(totalLoc)
                            .methodCount(totalMethods)
                            .floorCount(floorCount)
                            .cabinetCount(Math.max(1, Math.min(6, (totalLoc / 50) + 1)))
                            .languageChip(langChip)
                            .roleChip(roleChip)
                            .isTestFile(isTest)
                            .x(bx)
                            .y(by)
                            .width(bWidth)
                            .height(bHeight)
                            .color(palette[0])
                            .entryPoints(entryPoints)
                            .methods(allMethodNames)
                            .rooms(rooms)
                            .gapStatus(gapStatus)
                            .gapReason(gapReason)
                            .build();

                    distBuildings.add(bldg);
                }

                distLocalStreets.add(CityStreetDTO.builder()
                        .id("st_" + (streetCounter++))
                        .name(nKey + " Local Way")
                        .streetType("LOCAL_STREET")
                        .districtId(distId)
                        .x1(targetBlock.getX())
                        .y1(targetBlock.getY() + targetBlock.getHeight() + 4.0)
                        .x2(targetBlock.getX() + targetBlock.getWidth())
                        .y2(targetBlock.getY() + targetBlock.getHeight() + 4.0)
                        .width(6.0)
                        .laneCount(1)
                        .hasCenterline(false)
                        .isAvenue(false)
                        .surfaceColor("#101524")
                        .markingColor("#334155")
                        .build());
            }

            int layer = determineDistrictLayer(dKey, filePaths, typesByFile);
            districtDrafts.add(new DistrictDraft(dKey, districtName, distId, dWidth, dHeight, layer, palette, fileCount,
                    numNeighbourhoods, distBlocks, distBuildings, distLocalStreets));
        }

        // --- PHASE B: Aspect-Ratio-Optimized 2D Square Metropolis Packing ---
        double gapX = 48.0;
        double gapY = 52.0;
        double originX = 60.0;
        double originY = 60.0;

        double totalArea = 0;
        for (DistrictDraft d : districtDrafts) {
            totalArea += (d.width + gapX) * (d.height + gapY);
        }
        double targetSide = Math.sqrt(totalArea * 1.10);

        List<List<DistrictDraft>> bestRows = new ArrayList<>();
        double bestRatio = 999.0;
        double bestScore = Double.MAX_VALUE;
        double bestTotalW = 0.0;
        double bestTotalH = 0.0;

        for (int step = 0; step < 30; step++) {
            double candTargetW = targetSide * (0.60 + step * 0.04);
            List<List<DistrictDraft>> candidateRows = new ArrayList<>();
            List<DistrictDraft> curRow = new ArrayList<>();
            double curRowW = 0.0;
            double curRowH = 0.0;

            for (DistrictDraft d : districtDrafts) {
                double dw = d.width + gapX;
                double dh = d.height + gapY;

                if (!curRow.isEmpty() && (curRowW + dw > candTargetW)) {
                    candidateRows.add(curRow);
                    curRow = new ArrayList<>();
                    curRow.add(d);
                    curRowW = dw;
                    curRowH = dh;
                } else {
                    curRow.add(d);
                    curRowW += dw;
                    curRowH = Math.max(curRowH, dh);
                }
            }
            if (!curRow.isEmpty()) {
                candidateRows.add(curRow);
            }

            double candTotalW = 0.0;
            for (List<DistrictDraft> r : candidateRows) {
                double rw = r.stream().mapToDouble(d -> d.width + gapX).sum();
                candTotalW = Math.max(candTotalW, rw);
            }
            double candTotalH = 0.0;
            for (List<DistrictDraft> r : candidateRows) {
                double rh = r.stream().mapToDouble(d -> d.height + gapY).max().orElse(0.0);
                candTotalH += rh;
            }

            double ratio = candTotalH > 0 ? (candTotalW / candTotalH) : 1.0;
            double score = Math.abs(Math.log(ratio));

            if (score < bestScore) {
                bestRatio = ratio;
                bestScore = score;
                bestRows = candidateRows;
                bestTotalW = candTotalW;
                bestTotalH = candTotalH;
            }
        }

        if (bestRows.isEmpty() && !districtDrafts.isEmpty()) {
            bestRows.add(new ArrayList<>(districtDrafts));
        }

        // --- PHASE C: Position districts, blocks, buildings, and local streets ---
        double curY = originY;
        List<Double> rowBoundaries = new ArrayList<>();
        List<Double> colBoundaries = new ArrayList<>();
        int interCounter = 1;

        for (int rIdx = 0; rIdx < bestRows.size(); rIdx++) {
            List<DistrictDraft> row = bestRows.get(rIdx);
            double rowH = row.stream().mapToDouble(d -> d.height).max().orElse(180.0);
            double curX = originX;

            for (int cIdx = 0; cIdx < row.size(); cIdx++) {
                DistrictDraft d = row.get(cIdx);
                double dX = curX;
                double dY = curY;

                CityDistrictDTO distDTO = CityDistrictDTO.builder()
                        .id(d.distId)
                        .name(d.name)
                        .packageName(d.key)
                        .folderPath(d.key.replace('.', '/'))
                        .streetName(d.name + " Blvd")
                        .description(d.name + " (" + d.fileCount + " source files in " + d.numNeighbourhoods
                                + " neighbourhoods)")
                        .x(dX)
                        .y(dY)
                        .width(d.width)
                        .height(d.height)
                        .color(d.palette[0])
                        .bgTint(d.palette[1])
                        .buildingCount(d.fileCount)
                        .districtType(d.palette[2])
                        .neighbourhoodCount(d.numNeighbourhoods)
                        .build();

                districts.add(distDTO);

                // Offset blocks
                for (CityBlockDTO b : d.blocks) {
                    b.setX(b.getX() + dX);
                    b.setY(b.getY() + dY);
                    blocks.add(b);
                }

                // Offset buildings and sub-elements
                for (CityBuildingDTO b : d.buildings) {
                    b.setX(b.getX() + dX);
                    b.setY(b.getY() + dY);
                    b.setEntranceX(b.getEntranceX() + dX);
                    b.setEntranceY(b.getEntranceY() + dY);

                    if (b.getRooms() != null) {
                        for (CityRoomDTO rm : b.getRooms()) {
                            rm.setX(rm.getX() + dX);
                            rm.setY(rm.getY() + dY);
                            if (rm.getWorkstations() != null) {
                                for (CityWorkstationDTO ws : rm.getWorkstations()) {
                                    ws.setX(ws.getX() + dX);
                                    ws.setY(ws.getY() + dY);
                                }
                            }
                        }
                    }

                    buildings.add(b);
                    buildingByFile.put(b.getFileId(), b);
                    buildingByFile.put(b.getId(), b);
                }

                // Offset local streets
                for (CityStreetDTO s : d.localStreets) {
                    s.setX1(s.getX1() + dX);
                    s.setX2(s.getX2() + dX);
                    s.setY1(s.getY1() + dY);
                    s.setY2(s.getY2() + dY);
                    streets.add(s);
                }

                curX += d.width + gapX;
                if (!colBoundaries.contains(curX - gapX / 2.0)) {
                    colBoundaries.add(curX - gapX / 2.0);
                }
            }

            curY += rowH + gapY;
            rowBoundaries.add(curY - gapY / 2.0);
        }

        double totalCityW = Math.max(1200.0, bestTotalW + originX);
        double totalCityH = Math.max(900.0, curY);

        if (districts.isEmpty()) {
            CityDistrictDTO defaultDist = CityDistrictDTO.builder()
                    .id("district_root")
                    .name(repo.getRepoName() + " Core")
                    .packageName("root")
                    .folderPath("src")
                    .streetName("Main Metropolis Blvd")
                    .description("Metropolis core district")
                    .x(60.0)
                    .y(60.0)
                    .width(Math.max(360.0, totalCityW - 120.0))
                    .height(Math.max(260.0, totalCityH - 120.0))
                    .color("#3b82f6")
                    .bgTint("rgba(59, 130, 246, 0.08)")
                    .buildingCount(buildings.size())
                    .districtType("COMMERCIAL")
                    .neighbourhoodCount(1)
                    .build();
            districts.add(defaultDist);
        }

        // --- PHASE D: Synthesize Avenues and Boulevards between district rows/cols ---
        for (int i = 0; i < rowBoundaries.size(); i++) {
            double by = rowBoundaries.get(i);
            streets.add(CityStreetDTO.builder()
                    .id("ave_h_" + (streetCounter++))
                    .name("Metropolis Boulevard " + (i + 1))
                    .streetType("AVENUE")
                    .x1(20.0)
                    .y1(by)
                    .x2(totalCityW - 20.0)
                    .y2(by)
                    .width(20.0)
                    .laneCount(4)
                    .hasCenterline(true)
                    .isAvenue(true)
                    .surfaceColor("#161e31")
                    .markingColor("#38bdf8")
                    .build());
        }

        for (int i = 0; i < colBoundaries.size(); i++) {
            double ax = colBoundaries.get(i);
            streets.add(CityStreetDTO.builder()
                    .id("ave_v_" + (streetCounter++))
                    .name("Metropolis Avenue " + (i + 1))
                    .streetType("AVENUE")
                    .x1(ax)
                    .y1(20.0)
                    .x2(ax)
                    .y2(totalCityH - 20.0)
                    .width(18.0)
                    .laneCount(4)
                    .hasCenterline(true)
                    .isAvenue(true)
                    .surfaceColor("#161e31")
                    .markingColor("#38bdf8")
                    .build());
        }

        for (Double ax : colBoundaries) {
            for (Double by : rowBoundaries) {
                intersections.add(CityIntersectionDTO.builder()
                        .id("inter_" + (interCounter++))
                        .name("Junction @ (" + ax.intValue() + ", " + by.intValue() + ")")
                        .x(ax)
                        .y(by)
                        .radius(14.0)
                        .hasTrafficSignal(true)
                        .hasCrosswalk(true)
                        .build());
            }
        }

        // Official Infrastructure & Landmarks (Symbol Design System V1)
        List<CityLandmarkDTO> landmarks = new ArrayList<>();

        // 1. Database Data Centre
        boolean hasDb = allNodes.stream().anyMatch(n -> {
            String nt = (n.getNodeType() != null ? n.getNodeType() : "").toUpperCase();
            String nk = n.getNodeKey().toLowerCase();
            return nt.contains("REPOSITORY") || nt.contains("DAO") || nt.contains("DATABASE")
                    || nk.contains("repository") || nk.contains("dao") || nk.contains(".sql");
        });
        if (hasDb && !districts.isEmpty()) {
            CityDistrictDTO targetDist = districts.stream()
                    .filter(d -> d.getName().toLowerCase().contains("repository")
                            || d.getName().toLowerCase().contains("data") || d.getName().toLowerCase().contains("dao"))
                    .findFirst().orElse(districts.get(districts.size() - 1));
            landmarks.add(CityLandmarkDTO.builder()
                    .id("landmark_database_vault")
                    .name("Primary Data Centre (Database)")
                    .landmarkType("DATABASE_VAULT")
                    .districtId(targetDist.getId())
                    .x(targetDist.getX() + targetDist.getWidth() - 100.0)
                    .y(targetDist.getY() + targetDist.getHeight() - 88.0)
                    .width(88.0)
                    .height(74.0)
                    .silhouetteType("VAULT_DATABASE")
                    .color("#6fe38f")
                    .description("Dual-cylinder database storage & connection pool")
                    .evidence("Database persistence repository constructs detected in source")
                    .build());
        }

        // 2. Message Hub (Event Broker)
        boolean hasEvents = allNodes.stream().anyMatch(n -> {
            String nt = (n.getNodeType() != null ? n.getNodeType() : "").toUpperCase();
            String nk = n.getNodeKey().toLowerCase();
            return nt.contains("EVENT") || nk.contains("event") || nk.contains("kafka") || nk.contains("rabbit")
                    || nk.contains("listener") || nk.contains("pubsub");
        });
        if (hasEvents && !districts.isEmpty()) {
            CityDistrictDTO eventDist = districts.stream()
                    .filter(d -> d.getName().toLowerCase().contains("event")
                            || d.getName().toLowerCase().contains("service"))
                    .findFirst().orElse(districts.get(0));
            landmarks.add(CityLandmarkDTO.builder()
                    .id("landmark_message_hub")
                    .name("Message Hub (Event Broker)")
                    .landmarkType("MESSAGE_HUB")
                    .districtId(eventDist.getId())
                    .x(eventDist.getX() + eventDist.getWidth() - 94.0)
                    .y(eventDist.getY() + 38.0)
                    .width(82.0)
                    .height(72.0)
                    .silhouetteType("SUBSTATION_UTILITY")
                    .color("#c9a6ff")
                    .description("Asynchronous message router with radial antenna spokes")
                    .evidence("Event publish/listener constructs detected")
                    .build());
        }

        // 3. Queue Terminal
        boolean hasQueue = allNodes.stream().anyMatch(n -> {
            String nk = n.getNodeKey().toLowerCase();
            return nk.contains("queue") || nk.contains("batch") || nk.contains("consumer") || nk.contains("worker");
        });
        if (hasQueue && !districts.isEmpty()) {
            landmarks.add(CityLandmarkDTO.builder()
                    .id("landmark_queue_terminal")
                    .name("Async Queue Terminal")
                    .landmarkType("QUEUE_TERMINAL")
                    .districtId(districts.get(0).getId())
                    .x(districts.get(0).getX() + 30.0)
                    .y(districts.get(0).getY() + districts.get(0).getHeight() - 70.0)
                    .width(90.0)
                    .height(52.0)
                    .silhouetteType("SUBSTATION_UTILITY")
                    .color("#ffd166")
                    .description("FIFO queue terminal with slotted track")
                    .evidence("Async background worker/queue patterns detected")
                    .build());
        }

        // 4. System Clock Tower
        boolean hasScheduler = allNodes.stream().anyMatch(n -> {
            String nk = n.getNodeKey().toLowerCase();
            String ann = n.getAnnotationsJson() != null ? n.getAnnotationsJson().toLowerCase() : "";
            return nk.contains("schedule") || nk.contains("cron") || nk.contains("timer") || ann.contains("scheduled");
        });
        if (hasScheduler && !districts.isEmpty()) {
            landmarks.add(CityLandmarkDTO.builder()
                    .id("landmark_clock_tower")
                    .name("System Clock Tower (@Scheduled)")
                    .landmarkType("CLOCK_TOWER")
                    .districtId(districts.get(0).getId())
                    .x(districts.get(0).getX() + districts.get(0).getWidth() - 80.0)
                    .y(districts.get(0).getY() + 38.0)
                    .width(64.0)
                    .height(84.0)
                    .silhouetteType("TOWER_CONTROLLER")
                    .color("#ef476f")
                    .description("Cron scheduler tower with clock face and tick indicator")
                    .evidence("Scheduled cron background tasks detected")
                    .build());
        }

        // 5. Security Checkpoint & API Entrance Gate (Orientation Plaza)
        double midY = totalCityH / 2.0;
        boolean hasSecurity = allNodes.stream().anyMatch(n -> {
            String nk = n.getNodeKey().toLowerCase();
            return nk.contains("security") || nk.contains("auth") || nk.contains("jwt") || nk.contains("filter")
                    || nk.contains("guard");
        });
        if (hasSecurity && !districts.isEmpty()) {
            landmarks.add(CityLandmarkDTO.builder()
                    .id("landmark_security_checkpoint")
                    .name("Security Checkpoint (Auth / Firewall)")
                    .landmarkType("SECURITY_CHECKPOINT")
                    .districtId(districts.get(0).getId())
                    .x(20.0)
                    .y(Math.max(20.0, midY - 90.0))
                    .width(78.0)
                    .height(58.0)
                    .silhouetteType("MODULAR_ENTITY")
                    .color("#ffd166")
                    .description("Access control gatehouse with boom barrier and lock badge")
                    .evidence("Authentication, token validation or firewall middleware detected")
                    .build());
        }

        // Orientation Plaza / API Gateway
        landmarks.add(CityLandmarkDTO.builder()
                .id("landmark_api_entry_gate")
                .name("Metropolis Entry Gate (All Requests Enter Here)")
                .landmarkType("API_ENTRANCE_PORTAL")
                .districtId(!districts.isEmpty() ? districts.get(0).getId() : "district_root")
                .x(20.0)
                .y(Math.max(20.0, midY + 30.0))
                .width(82.0)
                .height(64.0)
                .silhouetteType("MODULAR_ENTITY")
                .color("#06b6d4")
                .description("Grand orientation portal & turnstiles for incoming client requests")
                .evidence("HTTP entry routes and API controller mapping detected")
                .build());

        // 6. Semantic Overlays (Symbol Design System V1 Overlays 1 to 8)
        List<CityRoadDTO> roads = new ArrayList<>();
        Set<String> addedRoadPair = new HashSet<>();
        int roadCounter = 1;

        for (ArchitectureEdge edge : allEdges) {
            String rel = edge.getRelationshipType() != null ? edge.getRelationshipType().toUpperCase() : "CALLS";
            // Structural edges - NEVER create physical/execution roads from IMPORTS,
            // EXTENDS, IMPLEMENTS, CONTAINS, DECLARES, EXPOSES
            if ("IMPORTS".equals(rel) || "EXTENDS".equals(rel) || "IMPLEMENTS".equals(rel) || "CONTAINS".equals(rel)
                    || "DECLARES".equals(rel) || "EXPOSES".equals(rel)) {
                continue;
            }

            String srcKey = edge.getSourceNodeKey();
            String tgtKey = edge.getTargetNodeKey();
            String srcRoomKey = srcKey;
            String tgtRoomKey = tgtKey;

            if (srcKey.contains("#"))
                srcKey = srcKey.substring(0, srcKey.indexOf('#'));
            if (tgtKey.contains("#"))
                tgtKey = tgtKey.substring(0, tgtKey.indexOf('#'));

            CityBuildingDTO srcBldg = buildingByFile.get(srcKey);
            CityBuildingDTO tgtBldg = buildingByFile.get(tgtKey);

            if (srcBldg != null && tgtBldg != null && !srcBldg.getId().equals(tgtBldg.getId())) {
                String roadPair = srcBldg.getId() + "->" + tgtBldg.getId() + ":" + rel;
                if (addedRoadPair.add(roadPair)) {
                    String roadType = "HIGHWAY";
                    String rColor = "#9eacc2"; // 1. Method call
                    int lanes = 2;
                    boolean dashed = false;

                    if ("PERSISTS_TO".equalsIgnoreCase(rel) || "DATABASE".equalsIgnoreCase(rel)) {
                        roadType = "ARTERIAL";
                        rColor = "#6fe38f"; // 2. Database
                    } else if ("EXTERNAL_CALL".equalsIgnoreCase(rel) || "THIRD_PARTY".equalsIgnoreCase(rel)) {
                        roadType = "ARTERIAL";
                        rColor = "#ffb347"; // 3. External
                        dashed = true;
                    } else if ("EVENT_ASYNC".equalsIgnoreCase(rel) || "EVENT_PUBLISH".equalsIgnoreCase(rel)
                            || "EVENT_CONSUME".equalsIgnoreCase(rel)) {
                        roadType = "LOCAL";
                        rColor = "#c9a6ff"; // 4. Async Event
                        dashed = true;
                        lanes = 1;
                    } else if ("EXTENDS".equalsIgnoreCase(rel)) {
                        roadType = "LOCAL";
                        rColor = "#f08fb8"; // 5. Inheritance
                        dashed = true;
                        lanes = 1;
                    } else if ("IMPLEMENTS".equalsIgnoreCase(rel)) {
                        roadType = "LOCAL";
                        rColor = "#c9a6ff"; // 6. Implements interface
                        lanes = 2;
                    } else if ("DEPENDS_ON".equalsIgnoreCase(rel) || "INJECTS".equalsIgnoreCase(rel)) {
                        roadType = "LOCAL";
                        rColor = "#75cff5"; // 7. Dependency injection
                        dashed = true;
                        lanes = 1;
                    }

                    roads.add(CityRoadDTO.builder()
                            .id("road_" + (roadCounter++))
                            .sourceBuildingId(srcBldg.getId())
                            .targetBuildingId(tgtBldg.getId())
                            .sourceRoomId(srcRoomKey)
                            .targetRoomId(tgtRoomKey)
                            .relationshipType(rel)
                            .roadType(roadType)
                            .roadName(roadType + ": " + srcBldg.getName() + " → " + tgtBldg.getName())
                            .laneCount(lanes)
                            .color(rColor)
                            .dashed(dashed)
                            .evidence(edge.getEvidence())
                            .evidenceLevel(edge.getEvidenceLevel())
                            .isExecutionPath(false)
                            .build());
                }
            }
        }

        CityStatsDTO stats = CityStatsDTO.builder()
                .totalDistricts(districts.size())
                .totalBuildings(buildings.size())
                .totalRoads(roads.size())
                .totalEndpoints(
                        (int) allNodes.stream().filter(n -> "API_ENDPOINT".equalsIgnoreCase(n.getNodeType())).count())
                .totalControllers((int) buildings.stream()
                        .filter(b -> "CONTROLLER".equalsIgnoreCase(b.getComponentType())).count())
                .totalServices(
                        (int) buildings.stream().filter(b -> "SERVICE".equalsIgnoreCase(b.getComponentType())).count())
                .totalRepositories((int) buildings.stream()
                        .filter(b -> "REPOSITORY".equalsIgnoreCase(b.getComponentType())).count())
                .totalEntities((int) buildings.stream()
                        .filter(b -> "ENTITY".equalsIgnoreCase(b.getComponentType())
                                || "DATABASE_TABLE".equalsIgnoreCase(b.getComponentType()))
                        .count())
                .totalTraces((int) runtimeTraceRepository.count())
                .build();

        return CityModelDTO.builder()
                .repositoryId(repo.getId())
                .repositoryName(repo.getRepoName())
                .commitSha(snapshot.getCommitSha())
                .primaryLanguage(snapshot.getPrimaryLanguage())
                .snapshotId(snapshot.getId())
                .cityWidth(totalCityW)
                .cityHeight(totalCityH)
                .districts(districts)
                .blocks(blocks)
                .streets(streets)
                .intersections(intersections)
                .buildings(buildings)
                .landmarks(landmarks)
                .roads(roads)
                .stats(stats)
                .build();
    }

    private String extractDistrictKey(String filePath, String packageName) {
        if (packageName != null && !packageName.isBlank() && !"default".equals(packageName)) {
            // Use package name or the last 2 segments if very deep
            String[] parts = packageName.split("\\.");
            if (parts.length >= 3) {
                return parts[parts.length - 2] + "." + parts[parts.length - 1];
            }
            return packageName;
        }
        if (filePath != null && !filePath.isBlank()) {
            int lastSlash = filePath.lastIndexOf('/');
            if (lastSlash != -1) {
                return filePath.substring(0, lastSlash);
            }
        }
        return "root";
    }

    private int determineDistrictLayer(String districtKey, List<String> filePaths,
            Map<String, List<ArchitectureNode>> typesByFile) {
        String keyLower = districtKey.toLowerCase();
        for (String f : filePaths) {
            List<ArchitectureNode> types = typesByFile.getOrDefault(f, Collections.emptyList());
            for (ArchitectureNode t : types) {
                String type = t.getNodeType() != null ? t.getNodeType().toUpperCase() : "";
                if (type.contains("CONTROLLER") || keyLower.contains("controller") || keyLower.contains("api")
                        || keyLower.contains("rest") || keyLower.contains("web")) {
                    return 0; // Layer 0: Entry / API Controllers
                }
            }
        }
        for (String f : filePaths) {
            List<ArchitectureNode> types = typesByFile.getOrDefault(f, Collections.emptyList());
            for (ArchitectureNode t : types) {
                String type = t.getNodeType() != null ? t.getNodeType().toUpperCase() : "";
                if (type.contains("SERVICE") || keyLower.contains("service") || keyLower.contains("core")
                        || keyLower.contains("domain")) {
                    return 1; // Layer 1: Services / Domain Core
                }
            }
        }
        return 2; // Layer 2: Repositories / Data / Utility / Config
    }

    private String[] getDistrictPalette(String districtKey, List<String> filePaths,
            Map<String, List<ArchitectureNode>> typesByFile) {
        String keyLower = districtKey.toLowerCase();
        for (String f : filePaths) {
            List<ArchitectureNode> types = typesByFile.getOrDefault(f, Collections.emptyList());
            for (ArchitectureNode t : types) {
                String type = t.getNodeType() != null ? t.getNodeType().toUpperCase() : "";
                if (type.contains("CONTROLLER") || keyLower.contains("controller") || keyLower.contains("web")
                        || keyLower.contains("api")) {
                    return new String[] { "#8ad7ff", "#1f2536", "CONTROLLER DISTRICT" };
                }
                if (type.contains("SERVICE") || keyLower.contains("service")) {
                    return new String[] { "#b9a7ff", "#1f2536", "SERVICE DISTRICT" };
                }
                if (type.contains("REPOSITORY") || type.contains("DAO") || keyLower.contains("repo")
                        || keyLower.contains("dao")) {
                    return new String[] { "#ffb3d1", "#1f2536", "REPOSITORY DISTRICT" };
                }
                if (type.contains("ENTITY") || type.contains("TABLE") || keyLower.contains("entity")
                        || keyLower.contains("model")) {
                    return new String[] { "#c8f08f", "#1f2536", "ENTITY DISTRICT" };
                }
                if (type.contains("CONFIG") || keyLower.contains("config") || keyLower.contains("security")) {
                    return new String[] { "#ffd88a", "#1f2536", "CONFIG DISTRICT" };
                }
            }
        }
        return new String[] { "#8b93a8", "#1f2536", "UTIL DISTRICT" };
    }

    private String formatDistrictName(String key) {
        if (key == null || key.isBlank() || "root".equalsIgnoreCase(key))
            return "Core District";
        String s = key;
        int lastDot = s.lastIndexOf('.');
        if (lastDot != -1)
            s = s.substring(lastDot + 1);
        int lastSlash = s.lastIndexOf('/');
        if (lastSlash != -1)
            s = s.substring(lastSlash + 1);
        return Character.toUpperCase(s.charAt(0)) + s.substring(1) + " District";
    }

    private String determineSilhouetteType(String nodeType) {
        String t = nodeType != null ? nodeType.toUpperCase() : "CLASS";
        if (t.contains("CONTROLLER"))
            return "TOWER_CONTROLLER";
        if (t.contains("SERVICE"))
            return "CAMPUS_SERVICE";
        if (t.contains("REPOSITORY"))
            return "BUNKER_REPOSITORY";
        if (t.contains("ENTITY") || t.contains("TABLE"))
            return "VAULT_DATABASE";
        if (t.contains("CONFIG"))
            return "MODULAR_ENTITY";
        return "SUBSTATION_UTILITY";
    }

    private String determineFootprintShape(String nodeType, int loc, int methods) {
        String t = nodeType != null ? nodeType.toUpperCase() : "CLASS";
        if (loc > 350 || methods > 12)
            return "H_SHAPED";
        if (loc > 200 || methods > 7)
            return "U_SHAPED";
        if (t.contains("CONTROLLER") || t.contains("SERVICE"))
            return "L_SHAPED";
        if (t.contains("REPOSITORY") || t.contains("ENTITY"))
            return "COURTYARD";
        return "RECTANGULAR";
    }

    private String determineRoofStyle(String nodeType, int floorCount) {
        String t = nodeType != null ? nodeType.toUpperCase() : "CLASS";
        if (floorCount >= 5)
            return "TERRACE_SOLAR";
        if (floorCount >= 3)
            return "PARAPET_HVAC";
        if (t.contains("SERVICE"))
            return "GABLE";
        if (t.contains("REPOSITORY"))
            return "HIP";
        return "FLAT_GRAVEL";
    }

    private String extractNeighbourhoodKey(String filePath, ArchitectureNode primaryType) {
        if (filePath != null) {
            String pathLower = filePath.toLowerCase();
            if (pathLower.contains("test") || pathLower.contains("spec"))
                return "Test Suite";
        }
        if (primaryType != null) {
            String nt = primaryType.getNodeType() != null ? primaryType.getNodeType().toUpperCase() : "";
            if (nt.contains("CONTROLLER") || nt.contains("API"))
                return "Controllers";
            if (nt.contains("SERVICE"))
                return "Services";
            if (nt.contains("REPOSITORY") || nt.contains("DAO"))
                return "Repositories";
            if (nt.contains("ENTITY") || nt.contains("TABLE") || nt.contains("MODEL"))
                return "Domain Entities";
            if (nt.contains("CONFIG") || nt.contains("SECURITY"))
                return "Configuration";
            if (primaryType.getPackageOrModule() != null) {
                String[] parts = primaryType.getPackageOrModule().split("\\.");
                if (parts.length > 0) {
                    String last = parts[parts.length - 1];
                    if (last.length() > 2) {
                        return Character.toUpperCase(last.charAt(0)) + last.substring(1);
                    }
                }
            }
        }
        return "Core Components";
    }

    private boolean isTestFile(String fileName, String filePath) {
        String fn = (fileName != null ? fileName : "").toLowerCase();
        String fp = (filePath != null ? filePath : "").toLowerCase();
        return fn.contains("test") || fn.contains("spec") || fp.contains("/test/") || fp.contains("__tests__");
    }

    private String determineLanguageChip(String filePath, String defaultLang) {
        if (filePath != null) {
            String f = filePath.toLowerCase();
            if (f.endsWith(".java"))
                return "JV";
            if (f.endsWith(".ts") || f.endsWith(".tsx"))
                return "TS";
            if (f.endsWith(".js") || f.endsWith(".jsx"))
                return "JS";
            if (f.endsWith(".py"))
                return "PY";
            if (f.endsWith(".go"))
                return "GO";
            if (f.endsWith(".rs"))
                return "RS";
            if (f.endsWith(".cs"))
                return "CS";
            if (f.endsWith(".rb"))
                return "RB";
            if (f.endsWith(".kt"))
                return "KT";
            if (f.endsWith(".sql"))
                return "SQL";
        }
        if (defaultLang != null) {
            String dl = defaultLang.toLowerCase();
            if (dl.contains("java"))
                return "JV";
            if (dl.contains("typescript"))
                return "TS";
            if (dl.contains("javascript"))
                return "JS";
            if (dl.contains("python"))
                return "PY";
            if (dl.contains("go"))
                return "GO";
            if (dl.contains("rust"))
                return "RS";
        }
        return "JV";
    }

    private String determineRoleChip(ArchitectureNode primaryType, boolean isTest) {
        if (isTest)
            return "TEST";
        if (primaryType == null)
            return "SRC";
        String nt = primaryType.getNodeType() != null ? primaryType.getNodeType().toUpperCase() : "";
        if (nt.contains("CONTROLLER") || nt.contains("API"))
            return "CTRL";
        if (nt.contains("SERVICE"))
            return "SERV";
        if (nt.contains("REPOSITORY") || nt.contains("DAO"))
            return "REPO";
        if (nt.contains("ENTITY") || nt.contains("TABLE") || nt.contains("MODEL"))
            return "ENT";
        if (nt.contains("CONFIG") || nt.contains("SECURITY"))
            return "CONF";
        if (nt.contains("EVENT") || nt.contains("LISTENER") || nt.contains("CONSUMER"))
            return "EVNT";
        return "UTIL";
    }

    // ======================================================================
    // DEDICATED JOURNEY GRAPH CONSTRUCTION & PLAYBACK (Part 6)
    // ======================================================================

    @Transactional(readOnly = true)
    public JourneyGraphDTO getJourneyGraph(Long repositoryId, Long endpointId, String mode) {
        CodeEndpoint ep = endpointRepository.findById(endpointId)
                .orElseThrow(() -> new IllegalArgumentException("Endpoint not found with ID: " + endpointId));

        Long snapshotId = ep.getSnapshot() != null ? ep.getSnapshot().getId() : null;
        if (snapshotId == null) {
            snapshotId = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repositoryId)
                    .map(ArchitectureSnapshot::getId)
                    .orElseThrow(() -> new IllegalArgumentException("Snapshot not found for endpoint: " + endpointId));
        }

        List<ArchitectureNode> allNodes = nodeRepository.findBySnapshotId(snapshotId);
        List<ArchitectureEdge> allEdges = edgeRepository.findBySnapshotId(snapshotId);
        CityModelDTO cityModel = getCityModel(repositoryId);

        Map<String, ArchitectureNode> nodeByKey = allNodes.stream()
                .collect(Collectors.toMap(ArchitectureNode::getNodeKey, n -> n, (a, b) -> a));

        Map<String, CityBuildingDTO> buildingByFileOrKey = new HashMap<>();
        if (cityModel != null && cityModel.getBuildings() != null) {
            for (CityBuildingDTO b : cityModel.getBuildings()) {
                buildingByFileOrKey.put(b.getId(), b);
                if (b.getFileId() != null)
                    buildingByFileOrKey.put(b.getFileId(), b);
                if (b.getFilePath() != null)
                    buildingByFileOrKey.put(b.getFilePath(), b);
                if (b.getRooms() != null) {
                    for (CityRoomDTO r : b.getRooms()) {
                        buildingByFileOrKey.put(r.getId(), b);
                        if (r.getWorkstations() != null) {
                            for (CityWorkstationDTO w : r.getWorkstations()) {
                                buildingByFileOrKey.put(w.getId(), b);
                            }
                        }
                    }
                }
            }
        }

        Map<String, CityRoadDTO> roadByPair = new HashMap<>();
        if (cityModel != null && cityModel.getRoads() != null) {
            for (CityRoadDTO r : cityModel.getRoads()) {
                roadByPair.put(r.getSourceBuildingId() + "->" + r.getTargetBuildingId(), r);
            }
        }

        // Discover Controller class and Handler Method
        String controllerKey = null;
        String handlerMethodKey = null;

        for (ArchitectureEdge edge : allEdges) {
            if (edge.getTargetNodeKey().equals(ep.getNodeKey())
                    && "EXPOSES".equalsIgnoreCase(edge.getRelationshipType())) {
                controllerKey = edge.getSourceNodeKey();
            }
            if (edge.getTargetNodeKey().equals(ep.getNodeKey())
                    && "HANDLES".equalsIgnoreCase(edge.getRelationshipType())) {
                handlerMethodKey = edge.getSourceNodeKey();
            }
        }

        if (controllerKey == null && ep.getControllerClass() != null) {
            String cleanTarget = cleanComponentName(ep.getControllerClass());
            controllerKey = allNodes.stream()
                    .filter(n -> n.getName().equalsIgnoreCase(ep.getControllerClass())
                            || cleanComponentName(n.getName()).equalsIgnoreCase(cleanTarget)
                            || n.getNodeKey().endsWith("." + ep.getControllerClass())
                            || (ep.getSourceFile() != null && ep.getSourceFile().equals(n.getFilePath())))
                    .map(ArchitectureNode::getNodeKey)
                    .findFirst().orElse(null);
        }

        if (handlerMethodKey == null && controllerKey != null) {
            String mKey = controllerKey + "#" + ep.getHandlerMethod();
            if (nodeByKey.containsKey(mKey)) {
                handlerMethodKey = mKey;
            }
        }

        List<JourneyNodeDTO> journeyNodes = new ArrayList<>();
        List<JourneyTransitionDTO> transitions = new ArrayList<>();
        List<BranchGroupDTO> branchGroups = new ArrayList<>();
        List<JourneyGraphDTO> asyncFlows = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // 1. Entry Gate Node
        String gateId = "gate:" + ep.getId();
        CityBuildingDTO ctrlBldg = controllerKey != null ? buildingByFileOrKey.get(controllerKey) : null;
        String districtId = ctrlBldg != null ? ctrlBldg.getDistrictId() : "dist_api";
        String bldgId = ctrlBldg != null ? ctrlBldg.getId() : controllerKey;

        JourneyNodeDTO gateNode = JourneyNodeDTO.builder()
                .id(gateId)
                .kind("ENDPOINT_GATE")
                .name(ep.getHttpMethod() + " " + ep.getRoutePath())
                .fileId(ctrlBldg != null ? ctrlBldg.getFileId() : ep.getSourceFile())
                .cityRef(CityRefDTO.builder()
                        .districtId(districtId)
                        .buildingId(bldgId)
                        .roomId(controllerKey)
                        .workstationId(handlerMethodKey)
                        .facilityId(null)
                        .build())
                .resolution("RESOLVED")
                .signature("HTTP " + ep.getHttpMethod() + " " + ep.getRoutePath())
                .returnType(ep.getResponseType() != null ? ep.getResponseType() : "ResponseEntity")
                .explanation("Entry API Gate on city perimeter exposing @" + ep.getHttpMethod() + "Mapping(\""
                        + ep.getRoutePath() + "\").")
                .evidence(List.of(EvidenceRefDTO.builder()
                        .type("STATIC")
                        .file(ep.getSourceFile())
                        .startLine(ep.getStartLine())
                        .endLine(ep.getEndLine())
                        .description("Discovered REST controller mapping")
                        .build()))
                .build();
        journeyNodes.add(gateNode);

        if (controllerKey == null) {
            warnings.add("Controller class not resolved in AST for endpoint " + ep.getRoutePath());
            return JourneyGraphDTO.builder()
                    .journeyId("journey_" + endpointId + "_" + (mode != null ? mode.toLowerCase() : "static"))
                    .snapshotId(snapshotId)
                    .endpointId(endpointId)
                    .mode(mode != null ? mode : "STATIC")
                    .entryNodeId(gateId)
                    .nodes(journeyNodes)
                    .transitions(transitions)
                    .branchGroups(branchGroups)
                    .asyncFlows(asyncFlows)
                    .warnings(warnings)
                    .httpMethod(ep.getHttpMethod())
                    .routePath(ep.getRoutePath())
                    .controllerClass(ep.getControllerClass())
                    .handlerMethod(ep.getHandlerMethod())
                    .totalSteps(1)
                    .inferredSummary("Direct Controller Endpoint")
                    .hasAlternativeBranches(false)
                    .build();
        }

        // 2. Controller Handler Node
        String actualHandlerKey = handlerMethodKey != null ? handlerMethodKey
                : (controllerKey + "#" + ep.getHandlerMethod());
        ArchitectureNode handlerNodeAST = nodeByKey.get(actualHandlerKey);
        String handlerSig = handlerNodeAST != null ? handlerNodeAST.getAnnotationsJson()
                : (ep.getHandlerMethod() + "()");

        JourneyNodeDTO handlerNode = JourneyNodeDTO.builder()
                .id(actualHandlerKey)
                .kind("METHOD")
                .name(ep.getHandlerMethod())
                .methodId(actualHandlerKey)
                .typeId(controllerKey)
                .fileId(ctrlBldg != null ? ctrlBldg.getFileId() : ep.getSourceFile())
                .cityRef(CityRefDTO.builder()
                        .districtId(districtId)
                        .buildingId(bldgId)
                        .roomId(controllerKey)
                        .workstationId(actualHandlerKey)
                        .build())
                .resolution(handlerNodeAST != null ? "RESOLVED" : "PARTIAL")
                .signature(handlerSig)
                .explanation(cleanComponentName(controllerKey) + "." + ep.getHandlerMethod()
                        + "() handles the incoming HTTP request.")
                .evidence(List.of(EvidenceRefDTO.builder()
                        .type("STATIC")
                        .file(ctrlBldg != null ? ctrlBldg.getFileId() : ep.getSourceFile())
                        .startLine(ep.getStartLine())
                        .endLine(ep.getEndLine())
                        .description("REST handler method in controller")
                        .build()))
                .build();
        journeyNodes.add(handlerNode);

        // Stage B: Security & Filter Chain Middleware
        boolean hasSecurity = allNodes.stream().anyMatch(n -> {
            String nk = n.getNodeKey().toLowerCase();
            return nk.contains("security") || nk.contains("auth") || nk.contains("jwt") || nk.contains("filter");
        });

        String previousNodeId = gateId;
        int transCounter = 1;

        if (hasSecurity) {
            String secNodeId = "security:filter_chain";
            JourneyNodeDTO secNode = JourneyNodeDTO.builder()
                    .id(secNodeId)
                    .kind("MIDDLEWARE")
                    .name("Security Filter Chain")
                    .resolution("RESOLVED")
                    .cityRef(CityRefDTO.builder()
                            .districtId(districtId)
                            .facilityId("landmark_security_checkpoint")
                            .build())
                    .signature("SecurityFilterChain.doFilter(request, response)")
                    .explanation(
                            "Spring Security filter chain intercepts request, validates authentication tokens, and evaluates @"
                                    + (ep.getAuthClassification() != null ? ep.getAuthClassification()
                                            : "AUTHENTICATED")
                                    + " authorization.")
                    .evidence(List.of(EvidenceRefDTO.builder()
                            .type("STATIC")
                            .description("Security configuration / filter chain detected in AST")
                            .build()))
                    .build();
            journeyNodes.add(secNode);

            transitions.add(JourneyTransitionDTO.builder()
                    .id("trans_" + (transCounter++))
                    .fromNodeId(previousNodeId)
                    .toNodeId(secNodeId)
                    .kind("CALL")
                    .sync("SYNC")
                    .scope("BUILDING")
                    .orderIndex(1)
                    .whatIsHappening(
                            "HTTP request passes through Security Checkpoint for authentication and filter verification.")
                    .whyInvolved("Request security gatekeeper")
                    .inputDetails("HTTP headers, Authorization Bearer token")
                    .processingDetails("JWT / session validation, CORS evaluation, CSRF verification")
                    .outputDetails("SecurityContextHolder populated with Principal")
                    .callExpression("SecurityFilterChain.doFilter()")
                    .resolution("RESOLVED")
                    .evidence(EvidenceRefDTO.builder().type("STATIC").description("Security filter chain execution")
                            .build())
                    .build());

            previousNodeId = secNodeId;
        }

        // Transition: Previous -> Controller Handler Workstation
        transitions.add(JourneyTransitionDTO.builder()
                .id("trans_" + (transCounter++))
                .fromNodeId(previousNodeId)
                .toNodeId(actualHandlerKey)
                .kind("CALL")
                .sync("SYNC")
                .scope("BUILDING")
                .roadId(null)
                .orderIndex(transCounter)
                .whatIsHappening("DispatcherServlet delivers HTTP " + ep.getHttpMethod() + " " + ep.getRoutePath()
                        + " request to " + cleanComponentName(controllerKey) + "." + ep.getHandlerMethod() + "().")
                .whyInvolved(
                        cleanComponentName(controllerKey) + " exposes the @" + ep.getHttpMethod() + "Mapping route.")
                .inputDetails("HTTP " + ep.getHttpMethod() + " request payload & query parameters")
                .processingDetails("Binds request parameters, deserializes payload")
                .outputDetails("ResponseEntity wrapped computation")
                .callExpression(
                        "HTTP " + ep.getHttpMethod() + " " + ep.getRoutePath() + " -> " + ep.getHandlerMethod() + "()")
                .resolution("RESOLVED")
                .evidence(EvidenceRefDTO.builder()
                        .type("STATIC")
                        .file(ep.getSourceFile())
                        .startLine(ep.getStartLine())
                        .description("REST handler declaration")
                        .build())
                .build());

        // 3. Traverse Call Graph starting from handler method and its class
        Set<String> visitedNodes = new HashSet<>();
        visitedNodes.add(gateId);
        visitedNodes.add(actualHandlerKey);

        Queue<String> callQueue = new ArrayDeque<>();
        callQueue.add(actualHandlerKey);
        // Also add controllerKey so class-level injected calls are traversed if
        // method-level edges are sparse
        callQueue.add(controllerKey);

        // Continue transition counter from preceding stages
        int maxDepth = 10;
        int visitedSteps = 0;

        List<JourneyTransitionDTO> forwardCalls = new ArrayList<>();
        List<JourneyTransitionDTO> returnTransitions = new ArrayList<>();

        while (!callQueue.isEmpty() && visitedSteps < maxDepth) {
            String currentNodeKey = callQueue.poll();
            visitedSteps++;

            List<ArchitectureEdge> outEdges = allEdges.stream()
                    .filter(e -> e.getSourceNodeKey().equals(currentNodeKey))
                    .filter(e -> "CALLS".equalsIgnoreCase(e.getRelationshipType())
                            || "PERSISTS_TO".equalsIgnoreCase(e.getRelationshipType())
                            || "EVENT_PUBLISH".equalsIgnoreCase(e.getRelationshipType())
                            || "EXCEPTION".equalsIgnoreCase(e.getRelationshipType())
                            || "THROWS".equalsIgnoreCase(e.getRelationshipType()))
                    .collect(Collectors.toList());

            for (ArchitectureEdge edge : outEdges) {
                String targetKey = edge.getTargetNodeKey();
                String rel = edge.getRelationshipType().toUpperCase();

                // Branch condition extraction
                String branchCond = null;
                String edgeEvidence = edge.getEvidence() != null ? edge.getEvidence() : "";
                if (edgeEvidence.contains("[if (")) {
                    int start = edgeEvidence.indexOf("[if (") + 5;
                    int end = edgeEvidence.indexOf(")]", start);
                    if (end != -1)
                        branchCond = edgeEvidence.substring(start, end);
                }

                // Event publication check (Prompt Part 6.5: separate async flows)
                if ("EVENT_PUBLISH".equals(rel) || targetKey.startsWith("event:publish")) {
                    String eventNodeId = "event_pub_" + (transCounter);
                    JourneyNodeDTO eventNode = JourneyNodeDTO.builder()
                            .id(eventNodeId)
                            .kind("EVENT_PUBLICATION")
                            .name("publishEvent()")
                            .cityRef(CityRefDTO.builder().facilityId("facility:message_hub").build())
                            .resolution("RESOLVED")
                            .explanation("Publishes application event via event publisher.")
                            .evidence(
                                    List.of(EvidenceRefDTO.builder().type("STATIC").description(edgeEvidence).build()))
                            .build();
                    journeyNodes.add(eventNode);

                    transitions.add(JourneyTransitionDTO.builder()
                            .id("trans_" + transCounter++)
                            .fromNodeId(currentNodeKey)
                            .toNodeId(eventNodeId)
                            .kind("EVENT_PUBLISH")
                            .sync("ASYNC")
                            .scope("EXTERNAL")
                            .orderIndex(transCounter)
                            .whatIsHappening(cleanComponentName(currentNodeKey) + " publishes domain event.")
                            .whyInvolved("Decoupled asynchronous notification")
                            .callExpression(edgeEvidence)
                            .resolution("RESOLVED")
                            .evidence(EvidenceRefDTO.builder().type("STATIC").description(edgeEvidence).build())
                            .build());

                    // Check if an event listener exists for this event
                    List<ArchitectureEdge> listenerEdges = allEdges.stream()
                            .filter(e -> "EVENT_CONSUME".equalsIgnoreCase(e.getRelationshipType()))
                            .collect(Collectors.toList());

                    if (!listenerEdges.isEmpty()) {
                        for (ArchitectureEdge lEdge : listenerEdges) {
                            String listenerMethod = lEdge.getSourceNodeKey();
                            ArchitectureNode lNode = nodeByKey.get(listenerMethod);
                            CityBuildingDTO lBldg = buildingByFileOrKey.get(listenerMethod);
                            asyncFlows.add(JourneyGraphDTO.builder()
                                    .journeyId("async_flow_" + listenerMethod)
                                    .snapshotId(snapshotId)
                                    .mode(mode != null ? mode : "STATIC")
                                    .entryNodeId(eventNodeId)
                                    .warnings(List.of(
                                            "Asynchronous event processing flow decoupled from synchronous request"))
                                    .inferredSummary("Event consumer: " + cleanComponentName(listenerMethod))
                                    .totalSteps(1)
                                    .build());
                        }
                    } else {
                        warnings.add("Event published but consumer/listener unresolved in AST");
                    }
                    continue;
                }

                // Exception throw check
                if ("EXCEPTION".equals(rel) || "THROWS".equals(rel) || targetKey.startsWith("exception:")) {
                    String excId = "exception_" + (transCounter);
                    JourneyNodeDTO excNode = JourneyNodeDTO.builder()
                            .id(excId)
                            .kind("UNRESOLVED")
                            .name("Throw Exception")
                            .resolution("RESOLVED")
                            .explanation("Throws exception when condition evaluates to true: if ("
                                    + (branchCond != null ? branchCond : "invalid") + ")")
                            .evidence(
                                    List.of(EvidenceRefDTO.builder().type("STATIC").description(edgeEvidence).build()))
                            .build();
                    journeyNodes.add(excNode);

                    // Add BranchGroup for alternative outcomes (Prompt Part 6.3)
                    String bgId = "branch_" + branchGroups.size() + 1;
                    BranchGroupDTO branchGroup = BranchGroupDTO.builder()
                            .id(bgId)
                            .atNodeId(currentNodeKey)
                            .conditionText(branchCond != null ? branchCond : "condition")
                            .outcomeKnown(false) // STATIC mode: outcome unknown statically
                            .outcomes(List.of(
                                    BranchOutcomeDTO.builder()
                                            .id(bgId + "_err")
                                            .label("if (" + (branchCond != null ? branchCond : "error") + ")")
                                            .targetNodeId(excId)
                                            .description("Throws exception on invalid input")
                                            .build(),
                                    BranchOutcomeDTO.builder()
                                            .id(bgId + "_ok")
                                            .label("else (valid)")
                                            .description("Execution continues")
                                            .build()))
                            .build();
                    branchGroups.add(branchGroup);

                    transitions.add(JourneyTransitionDTO.builder()
                            .id("trans_" + transCounter++)
                            .fromNodeId(currentNodeKey)
                            .toNodeId(excId)
                            .kind("EXCEPTION")
                            .sync("SYNC")
                            .scope("WORKSTATION")
                            .branchGroupId(bgId)
                            .branchLabel("if (" + (branchCond != null ? branchCond : "invalid") + ")")
                            .orderIndex(transCounter)
                            .whatIsHappening("Throws exception: " + edgeEvidence)
                            .whyInvolved("Alternative conditional branch triggered")
                            .callExpression(edgeEvidence)
                            .resolution("RESOLVED")
                            .evidence(EvidenceRefDTO.builder().type("STATIC").description(edgeEvidence).build())
                            .build());
                    continue;
                }

                // Determine target method, class, file and building
                String targetClassKey = targetKey.contains("#") ? targetKey.substring(0, targetKey.indexOf('#'))
                        : targetKey;
                String targetMethodName = targetKey.contains("#") ? targetKey.substring(targetKey.indexOf('#') + 1)
                        : "execute";

                ArchitectureNode targetNodeAST = nodeByKey.get(targetKey);
                if (targetNodeAST == null)
                    targetNodeAST = nodeByKey.get(targetClassKey);

                String currentClassKey = currentNodeKey.contains("#")
                        ? currentNodeKey.substring(0, currentNodeKey.indexOf('#'))
                        : currentNodeKey;
                CityBuildingDTO srcBldg = buildingByFileOrKey.get(currentNodeKey);
                if (srcBldg == null)
                    srcBldg = buildingByFileOrKey.get(currentClassKey);

                CityBuildingDTO tgtBldg = buildingByFileOrKey.get(targetClassKey);
                if (tgtBldg == null && targetNodeAST != null && targetNodeAST.getFilePath() != null) {
                    tgtBldg = buildingByFileOrKey.get(targetNodeAST.getFilePath());
                }

                // Multi-tier scope movement (Prompt Part 6.2):
                // 1. Same class: WORKSTATION (no road, building stays active)
                // 2. Same file, different class: ROOM (no road to another building)
                // 3. Different file: BUILDING (road between buildings)
                // 4. External / DB: EXTERNAL (facility)
                String scope;
                String roadId = null;

                boolean isSameClass = currentClassKey.equalsIgnoreCase(targetClassKey);
                boolean isSameFile = (srcBldg != null && tgtBldg != null && srcBldg.getId().equals(tgtBldg.getId()));

                if (isSameClass) {
                    scope = "WORKSTATION";
                } else if (isSameFile) {
                    scope = "ROOM";
                } else if (tgtBldg != null) {
                    scope = "BUILDING";
                    // Match resolved road
                    CityRoadDTO road = (srcBldg != null) ? roadByPair.get(srcBldg.getId() + "->" + tgtBldg.getId())
                            : null;
                    if (road == null && srcBldg != null)
                        road = roadByPair.get(tgtBldg.getId() + "->" + srcBldg.getId());
                    roadId = road != null ? road.getId() : null;
                } else {
                    scope = "EXTERNAL";
                }

                // Check for Framework Operation (Spring Data JPA repo save(), findById(), etc.)
                boolean isFrameworkOp = false;
                String kind = "METHOD";
                if ("PERSISTS_TO".equalsIgnoreCase(rel) || targetClassKey.toLowerCase().contains("repository")
                        || targetClassKey.toLowerCase().contains("dao")) {
                    if (targetNodeAST != null && "REPOSITORY".equalsIgnoreCase(targetNodeAST.getNodeType())) {
                        isFrameworkOp = true;
                        kind = "FRAMEWORK_OPERATION";
                    }
                }

                if (!visitedNodes.contains(targetKey)) {
                    visitedNodes.add(targetKey);
                    callQueue.add(targetKey);

                    String tDistrict = tgtBldg != null ? tgtBldg.getDistrictId() : "dist_external";
                    String tBuilding = tgtBldg != null ? tgtBldg.getId() : targetClassKey;

                    JourneyNodeDTO jNode = JourneyNodeDTO.builder()
                            .id(targetKey)
                            .kind(kind)
                            .name(targetMethodName)
                            .methodId(targetKey)
                            .typeId(targetClassKey)
                            .fileId(tgtBldg != null ? tgtBldg.getFileId()
                                    : (targetNodeAST != null ? targetNodeAST.getFilePath() : null))
                            .cityRef(CityRefDTO.builder()
                                    .districtId(tDistrict)
                                    .buildingId(tBuilding)
                                    .roomId(targetClassKey)
                                    .workstationId(targetKey)
                                    .facilityId(scope.equals("EXTERNAL") ? "facility:external" : null)
                                    .build())
                            .resolution(targetNodeAST != null ? "RESOLVED" : "PARTIAL")
                            .signature(targetNodeAST != null ? targetNodeAST.getAnnotationsJson()
                                    : (targetMethodName + "()"))
                            .explanation(isFrameworkOp
                                    ? "Framework-provided repository operation (database execution not runtime-observed)."
                                    : cleanComponentName(currentNodeKey) + " invokes "
                                            + cleanComponentName(targetClassKey) + "." + targetMethodName + "().")
                            .evidence(List.of(EvidenceRefDTO.builder()
                                    .type(isFrameworkOp ? "INFERRED" : "STATIC")
                                    .file(tgtBldg != null ? tgtBldg.getFileId() : null)
                                    .startLine(targetNodeAST != null ? targetNodeAST.getStartLine() : null)
                                    .description(edgeEvidence)
                                    .build()))
                            .build();
                    journeyNodes.add(jNode);

                    String transId = "trans_" + transCounter++;
                    JourneyTransitionDTO forwardTrans = JourneyTransitionDTO.builder()
                            .id(transId)
                            .fromNodeId(currentNodeKey)
                            .toNodeId(targetKey)
                            .kind("CALL")
                            .sync("SYNC")
                            .scope(scope)
                            .roadId(roadId)
                            .orderIndex(transCounter)
                            .whatIsHappening(isFrameworkOp
                                    ? "Repository operation detected: " + targetMethodName
                                            + "() (database execution not runtime-observed)"
                                    : cleanComponentName(currentNodeKey) + " invokes "
                                            + cleanComponentName(targetClassKey) + "." + targetMethodName + "().")
                            .whyInvolved(isFrameworkOp ? "Persistence operation" : "Business logic delegation")
                            .callExpression(edgeEvidence)
                            .resolution(targetNodeAST != null ? "RESOLVED" : "PARTIAL")
                            .evidence(EvidenceRefDTO.builder()
                                    .type("STATIC")
                                    .description(edgeEvidence)
                                    .build())
                            .build();

                    transitions.add(forwardTrans);
                    forwardCalls.add(forwardTrans);

                    // Add corresponding RETURN transition (Prompt Part 6.4: actual return
                    // unwinding)
                    returnTransitions.add(JourneyTransitionDTO.builder()
                            .id("ret_" + forwardTrans.getId())
                            .fromNodeId(targetKey)
                            .toNodeId(currentNodeKey)
                            .kind("RETURN")
                            .sync("SYNC")
                            .scope(scope)
                            .roadId(roadId)
                            .orderIndex(100 + transCounter)
                            .whatIsHappening("Control and result return from " + cleanComponentName(targetClassKey)
                                    + " to " + cleanComponentName(currentNodeKey) + ".")
                            .whyInvolved("Unwinds call stack to caller.")
                            .callExpression("return from " + targetMethodName + "()")
                            .resolution("RESOLVED")
                            .evidence(EvidenceRefDTO.builder().type("STATIC").description("Method return").build())
                            .build());
                }
            }
        }

        // Return from Handler to Gate
        returnTransitions.add(JourneyTransitionDTO.builder()
                .id("ret_gate")
                .fromNodeId(actualHandlerKey)
                .toNodeId(gateId)
                .kind("RETURN")
                .sync("SYNC")
                .scope("BUILDING")
                .roadId(null)
                .orderIndex(200)
                .whatIsHappening(cleanComponentName(controllerKey) + " returns HTTP response through Entry Gate.")
                .whyInvolved("Terminal response serialization to client.")
                .callExpression("return ResponseEntity (HTTP 200 OK)")
                .resolution("RESOLVED")
                .evidence(EvidenceRefDTO.builder().type("STATIC").description("Controller return").build())
                .build());

        // Add return transitions (Prompt Part 6.4)
        transitions.addAll(returnTransitions);

        // Inferred summary
        String summary = journeyNodes.stream()
                .filter(n -> "METHOD".equals(n.getKind()) || "FRAMEWORK_OPERATION".equals(n.getKind()))
                .map(n -> cleanComponentName(n.getTypeId() != null ? n.getTypeId() : n.getName()))
                .distinct()
                .collect(Collectors.joining(" → "));

        return JourneyGraphDTO.builder()
                .journeyId("journey_" + endpointId + "_" + (mode != null ? mode.toLowerCase() : "static"))
                .snapshotId(snapshotId)
                .endpointId(endpointId)
                .mode(mode != null ? mode : "STATIC")
                .entryNodeId(gateId)
                .nodes(journeyNodes)
                .transitions(transitions)
                .branchGroups(branchGroups)
                .asyncFlows(asyncFlows)
                .warnings(warnings)
                .httpMethod(ep.getHttpMethod())
                .routePath(ep.getRoutePath())
                .controllerClass(ep.getControllerClass())
                .handlerMethod(ep.getHandlerMethod())
                .totalSteps(transitions.size())
                .inferredSummary(summary.isEmpty() ? "Direct Controller Handler" : summary)
                .hasAlternativeBranches(!branchGroups.isEmpty())
                .build();
    }

    @Transactional(readOnly = true)
    public ExecutionPathDTO getStaticExecutionPath(Long endpointId) {
        CodeEndpoint ep = endpointRepository.findById(endpointId)
                .orElseThrow(() -> new IllegalArgumentException("Endpoint not found with ID: " + endpointId));

        Optional<StaticExecutionPath> existingOpt = executionPathRepository.findByEndpointId(endpointId);
        if (existingOpt.isPresent()) {
            StaticExecutionPath p = existingOpt.get();
            List<ExecutionStepDTO> stepDTOs = new ArrayList<>();
            List<StaticExecutionStep> rawSteps = p.getSteps() != null ? p.getSteps() : Collections.emptyList();
            for (StaticExecutionStep s : rawSteps) {
                stepDTOs.add(ExecutionStepDTO.builder()
                        .stepIndex(s.getStepIndex())
                        .sourceComponentKey(s.getSourceComponentKey())
                        .sourceComponentName(cleanComponentName(s.getSourceComponentName()))
                        .targetComponentKey(s.getTargetComponentKey())
                        .targetComponentName(cleanComponentName(s.getTargetComponentName()))
                        .sourceMethod(s.getSourceMethod())
                        .targetMethod(s.getTargetMethod())
                        .callExpression(s.getCallExpression())
                        .relationshipType(s.getRelationshipType())
                        .branchCondition(s.getBranchCondition())
                        .evidence(s.getEvidence())
                        .isResolved(s.getIsResolved())
                        .fileName(cleanComponentName(s.getTargetComponentName()) + ".java")
                        .folderPath("src/main/java")
                        .whatIsHappening(s.getCallExpression())
                        .whyInvolved("Execution step")
                        .inputDetails("Input parameters")
                        .processingDetails("Processes step"
                                + (s.getBranchCondition() != null ? " [if (" + s.getBranchCondition() + ")]" : ""))
                        .outputDetails("Return value")
                        .sourceEvidence(s.getEvidence())
                        .confidence("Static · AST ✓")
                        .build());
            }

            List<ExecutionStepDTO> respSteps = new ArrayList<>();
            for (int i = stepDTOs.size() - 1, rIdx = 1; i >= 0; i--, rIdx++) {
                ExecutionStepDTO s = stepDTOs.get(i);
                respSteps.add(ExecutionStepDTO.builder()
                        .stepIndex(rIdx)
                        .sourceComponentKey(s.getTargetComponentKey())
                        .sourceComponentName(s.getTargetComponentName())
                        .targetComponentKey(s.getSourceComponentKey())
                        .targetComponentName(s.getSourceComponentName())
                        .sourceMethod(s.getTargetMethod())
                        .targetMethod(s.getSourceMethod())
                        .callExpression("Return from " + s.getTargetComponentName())
                        .relationshipType("RETURN")
                        .fileName(s.getFileName())
                        .folderPath(s.getFolderPath())
                        .whatIsHappening("Returns to " + s.getSourceComponentName())
                        .whyInvolved("Unwinds call stack")
                        .inputDetails(s.getOutputDetails())
                        .processingDetails("Serializes return value")
                        .outputDetails("Response payload")
                        .sourceEvidence(s.getSourceEvidence())
                        .confidence("Static · AST ✓")
                        .build());
            }

            List<String> involvedKeys = new ArrayList<>();
            for (ExecutionStepDTO s : stepDTOs) {
                if (s.getSourceComponentKey() != null)
                    involvedKeys.add(s.getSourceComponentKey());
                if (s.getTargetComponentKey() != null)
                    involvedKeys.add(s.getTargetComponentKey());
            }

            return ExecutionPathDTO.builder()
                    .id(p.getId())
                    .endpointId(ep.getId())
                    .httpMethod(ep.getHttpMethod())
                    .routePath(ep.getRoutePath())
                    .totalSteps(stepDTOs.size())
                    .inferredSummary(p.getInferredSummary())
                    .hasAlternativeBranches(p.getHasAlternativeBranches())
                    .involvedBuildingKeys(involvedKeys.stream().distinct().collect(Collectors.toList()))
                    .steps(stepDTOs)
                    .responseSteps(respSteps)
                    .build();
        }

        Long repoId = ep.getRepository() != null ? ep.getRepository().getId() : null;
        JourneyGraphDTO jGraph = getJourneyGraph(repoId, endpointId, "STATIC");

        // Convert JourneyGraphDTO to ExecutionPathDTO for backwards compatibility
        List<ExecutionStepDTO> reqSteps = new ArrayList<>();
        int stepIdx = 1;

        for (JourneyTransitionDTO t : jGraph.getTransitions()) {
            if ("CALL".equalsIgnoreCase(t.getKind()) || "EVENT_PUBLISH".equalsIgnoreCase(t.getKind())
                    || "EXCEPTION".equalsIgnoreCase(t.getKind())) {
                JourneyNodeDTO srcNode = jGraph.getNodes().stream().filter(n -> n.getId().equals(t.getFromNodeId()))
                        .findFirst().orElse(null);
                JourneyNodeDTO tgtNode = jGraph.getNodes().stream().filter(n -> n.getId().equals(t.getToNodeId()))
                        .findFirst().orElse(null);

                String sKey = srcNode != null ? (srcNode.getTypeId() != null ? srcNode.getTypeId() : srcNode.getId())
                        : t.getFromNodeId();
                String tKey = tgtNode != null ? (tgtNode.getTypeId() != null ? tgtNode.getTypeId() : tgtNode.getId())
                        : t.getToNodeId();

                String fPath = tgtNode != null && tgtNode.getFileId() != null ? tgtNode.getFileId()
                        : (srcNode != null ? srcNode.getFileId() : ep.getSourceFile());
                String fName = "SourceFile.java";
                String folder = "src";
                if (fPath != null) {
                    int lastSlash = Math.max(fPath.lastIndexOf('/'), fPath.lastIndexOf('\\'));
                    if (lastSlash != -1) {
                        fName = fPath.substring(lastSlash + 1);
                        folder = fPath.substring(0, lastSlash);
                    }
                }

                reqSteps.add(ExecutionStepDTO.builder()
                        .stepIndex(stepIdx++)
                        .sourceComponentKey(sKey)
                        .sourceComponentName(cleanComponentName(sKey))
                        .targetComponentKey(tKey)
                        .targetComponentName(cleanComponentName(tKey))
                        .sourceMethod(srcNode != null ? srcNode.getName() : "caller")
                        .targetMethod(tgtNode != null ? tgtNode.getName() : "callee")
                        .callExpression(t.getCallExpression())
                        .relationshipType(t.getKind())
                        .branchCondition(t.getBranchLabel())
                        .evidence(t.getEvidence() != null ? t.getEvidence().getDescription() : null)
                        .isResolved("RESOLVED".equalsIgnoreCase(t.getResolution()))
                        .fileName(fName)
                        .folderPath(folder)
                        .whatIsHappening(t.getWhatIsHappening())
                        .whyInvolved(t.getWhyInvolved())
                        .inputDetails(t.getInputDetails() != null ? t.getInputDetails() : "Input arguments")
                        .processingDetails(
                                t.getProcessingDetails() != null ? t.getProcessingDetails() : "Processes logic")
                        .outputDetails(t.getOutputDetails() != null ? t.getOutputDetails() : "Return value")
                        .sourceEvidence(fPath != null ? fPath : "Source reference")
                        .confidence("Static · AST ✓")
                        .build());
            }
        }

        // Build actual response steps following return transitions (Prompt Part 6.4:
        // NOT mechanically reversed!)
        List<ExecutionStepDTO> respSteps = new ArrayList<>();
        int respIdx = 1;

        for (int i = reqSteps.size() - 1; i >= 0; i--) {
            ExecutionStepDTO callStep = reqSteps.get(i);
            String retType = (i == 0) ? "ResponseEntity (HTTP 200 OK)" : (callStep.getTargetMethod() + "Response");
            respSteps.add(ExecutionStepDTO.builder()
                    .stepIndex(respIdx++)
                    .sourceComponentKey(callStep.getTargetComponentKey())
                    .sourceComponentName(callStep.getTargetComponentName())
                    .targetComponentKey(callStep.getSourceComponentKey())
                    .targetComponentName(callStep.getSourceComponentName())
                    .sourceMethod(callStep.getTargetMethod())
                    .targetMethod(callStep.getSourceMethod())
                    .callExpression("Return " + retType)
                    .relationshipType("RETURN")
                    .fileName(callStep.getFileName())
                    .folderPath(callStep.getFolderPath())
                    .whatIsHappening("Response data returns from " + callStep.getTargetComponentName() + " to "
                            + callStep.getSourceComponentName() + ".")
                    .whyInvolved("Unwinds call stack back to caller.")
                    .inputDetails("Computation result from " + callStep.getTargetComponentName())
                    .processingDetails("Serializes return payload across component boundary.")
                    .outputDetails(retType)
                    .sourceEvidence(callStep.getSourceEvidence())
                    .confidence("Static · AST ✓")
                    .build());
        }

        List<String> involvedKeys = new ArrayList<>();
        for (ExecutionStepDTO s : reqSteps) {
            if (s.getSourceComponentKey() != null)
                involvedKeys.add(s.getSourceComponentKey());
            if (s.getTargetComponentKey() != null)
                involvedKeys.add(s.getTargetComponentKey());
        }

        return ExecutionPathDTO.builder()
                .id(endpointId)
                .endpointId(endpointId)
                .httpMethod(ep.getHttpMethod())
                .routePath(ep.getRoutePath())
                .totalSteps(reqSteps.size())
                .inferredSummary(jGraph.getInferredSummary())
                .hasAlternativeBranches(jGraph.isHasAlternativeBranches())
                .involvedBuildingKeys(involvedKeys.stream().distinct().collect(Collectors.toList()))
                .steps(reqSteps)
                .responseSteps(respSteps)
                .build();
    }

    // ======================================================================
    // API QUERY METHODS & RUNTIME TRACING
    // ======================================================================

    public CityModelDTO getCityModel(Long repoId) {
        com.impactmapper.entity.Repository repo = repositoryRepository.findById(repoId)
                .orElseThrow(() -> new RepoNotFoundException("Repository not found with ID: " + repoId));

        ArchitectureSnapshot snapshot = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repoId)
                .orElseGet(() -> {
                    log.info("No snapshot found for repository {} (ID {}), initiating on-demand architecture analysis...", repo.getRepoName(), repoId);
                    ArchitectureAnalysisService analysisService = architectureAnalysisServiceProvider.getIfAvailable();
                    if (analysisService != null) {
                        try {
                            return analysisService.analyzeRepositoryArchitecture(repo);
                        } catch (Exception ex) {
                            log.error("Failed on-demand architecture analysis for repo {}: {}", repo.getRepoName(), ex.getMessage());
                        }
                    }
                    return null;
                });

        if (snapshot == null) {
            throw new IllegalArgumentException("No architecture snapshot available for repository "
                    + repo.getRepoName() + ". Please index repository source code first.");
        }

        CityModelDTO cached = cityModelCache.get(snapshot.getId());
        if (cached != null) {
            return cached;
        }

        List<ArchitectureNode> allNodes = nodeRepository.findBySnapshotId(snapshot.getId());
        List<ArchitectureEdge> allEdges = edgeRepository.findBySnapshotId(snapshot.getId());

        // Ensure endpoints are synced if not yet synchronized into code_endpoints
        if (allNodes.stream().anyMatch(n -> "API_ENDPOINT".equalsIgnoreCase(n.getNodeType()))) {
            if (endpointRepository.countBySnapshotId(snapshot.getId()) == 0) {
                syncEndpoints(repo, snapshot, allNodes, allEdges);
            }
        }

        CityModelDTO model = computeSpatialLayout(repo, snapshot, allNodes, allEdges);
        cityModelCache.put(snapshot.getId(), model);
        return model;
    }

    @Transactional(readOnly = true)
    public List<EndpointDTO> getEndpoints(Long repoId) {
        ArchitectureSnapshot snapshot = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repoId)
                .orElse(null);
        if (snapshot == null)
            return Collections.emptyList();

        List<CodeEndpoint> entities = endpointRepository.findBySnapshotIdOrderByRoutePathAsc(snapshot.getId());
        List<ArchitectureNode> allNodes = null;
        List<ArchitectureEdge> allEdges = null;

        // On-demand sync: If endpoints table is empty, lazily load nodes & edges to perform one-time extraction
        if (entities.isEmpty()) {
            allNodes = nodeRepository.findBySnapshotId(snapshot.getId());
            allEdges = edgeRepository.findBySnapshotId(snapshot.getId());
            if (allNodes.stream().anyMatch(n -> "API_ENDPOINT".equalsIgnoreCase(n.getNodeType()))) {
                com.impactmapper.entity.Repository repo = repositoryRepository.findById(repoId).orElse(null);
                if (repo != null) {
                    syncEndpoints(repo, snapshot, allNodes, allEdges);
                    entities = endpointRepository.findBySnapshotIdOrderByRoutePathAsc(snapshot.getId());
                }
            }
        }

        if (entities.isEmpty()) {
            return Collections.emptyList();
        }

        // Fast O(1) Stage Indexing: Pre-index edge targets by source controller to avoid O(Endpoints * Edges) nested loops
        if (allEdges == null) {
            allEdges = edgeRepository.findBySnapshotId(snapshot.getId());
        }

        boolean hasSecurity = false;
        if (allNodes != null) {
            hasSecurity = allNodes.stream().anyMatch(n -> {
                String k = n.getNodeKey().toLowerCase();
                return k.contains("security") || k.contains("auth") || k.contains("jwt") || k.contains("filter");
            });
        } else {
            hasSecurity = entities.stream().anyMatch(e -> e.getAuthClassification() != null && !e.getAuthClassification().equalsIgnoreCase("PUBLIC"));
        }

        Set<String> controllersCallingService = new HashSet<>();
        Set<String> controllersCallingRepo = new HashSet<>();
        boolean hasExternalCalls = false;

        for (ArchitectureEdge e : allEdges) {
            String src = e.getSourceNodeKey();
            String tgt = e.getTargetNodeKey().toLowerCase();
            if (tgt.contains("service") || tgt.contains("manager")) {
                controllersCallingService.add(src);
            }
            if ("PERSISTS_TO".equalsIgnoreCase(e.getRelationshipType())
                    || tgt.contains("repository")
                    || tgt.contains("dao")) {
                controllersCallingRepo.add(src);
            }
            if (tgt.contains("client") || tgt.contains("feign") || tgt.contains("http")) {
                hasExternalCalls = true;
            }
        }

        final boolean finalHasSecurity = hasSecurity;
        final boolean finalHasExternal = hasExternalCalls;

        return entities.stream().map(e -> {
            List<String> stages = calculateStagesFast(e, finalHasSecurity, controllersCallingService, controllersCallingRepo, finalHasExternal);
            int estSteps = Math.max(stages.size() * 2, 2);
            return EndpointDTO.builder()
                    .id(e.getId())
                    .httpMethod(e.getHttpMethod())
                    .routePath(e.getRoutePath())
                    .controllerClass(e.getControllerClass())
                    .handlerMethod(e.getHandlerMethod())
                    .parametersJson(e.getParametersJson())
                    .requestBodyType(e.getRequestBodyType())
                    .responseType(e.getResponseType())
                    .sourceFile(e.getSourceFile())
                    .startLine(e.getStartLine())
                    .endLine(e.getEndLine())
                    .nodeKey(e.getNodeKey())
                    .estimatedSteps(estSteps)
                    .apiCategory(e.getApiCategory() != null ? e.getApiCategory() : "REST")
                    .authClassification(e.getAuthClassification() != null ? e.getAuthClassification() : "AUTHENTICATED")
                    .analysisStatus(e.getAnalysisStatus() != null ? e.getAnalysisStatus() : "COMPLETE")
                    .journeyStatus("AVAILABLE")
                    .stages(stages)
                    .build();
        }).collect(Collectors.toList());
    }

    private List<String> calculateStagesFast(CodeEndpoint ep, boolean hasSecurity,
            Set<String> controllersCallingService, Set<String> controllersCallingRepo, boolean hasExternalCalls) {
        List<String> stages = new ArrayList<>(6);
        stages.add("REQUEST_ENTRY");

        if (hasSecurity) {
            stages.add("SECURITY_MIDDLEWARE");
        }

        stages.add("CONTROLLER");

        String ctrl = ep.getControllerClass();
        boolean callsService = false;
        if (ctrl != null) {
            for (String src : controllersCallingService) {
                if (src.contains(ctrl)) {
                    callsService = true;
                    break;
                }
            }
        }

        if (callsService) {
            stages.add("BUSINESS_SERVICE");
        }

        boolean callsRepo = false;
        if (ctrl != null) {
            for (String src : controllersCallingRepo) {
                if (src.contains(ctrl) || callsService) {
                    callsRepo = true;
                    break;
                }
            }
        }

        if (callsRepo) {
            stages.add("DATA_ACCESS");
        }

        if (hasExternalCalls) {
            stages.add("EXTERNAL_SERVICE");
        }

        stages.add("RESPONSE_CONSTRUCTION");
        return stages;
    }

    @Transactional(readOnly = true)
    public ApiCoverageDTO getApiCoverage(Long repoId) {
        com.impactmapper.entity.Repository repo = repositoryRepository.findById(repoId)
                .orElseThrow(() -> new RepoNotFoundException("Repository not found with ID: " + repoId));
        ArchitectureSnapshot snapshot = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repoId)
                .orElse(null);
        if (snapshot == null) {
            return ApiCoverageDTO.builder()
                    .repositoryId(repoId)
                    .repositoryName(repo.getRepoName())
                    .totalExposedApis(0)
                    .resolvedEntryPoints(0)
                    .completeJourneys(0)
                    .partialJourneys(0)
                    .unresolvedSegments(0)
                    .unsupportedApis(0)
                    .runtimeObservedJourneys(0)
                    .coveragePercentage(0.0)
                    .build();
        }

        List<EndpointDTO> apis = getEndpoints(repoId);
        List<RuntimeTrace> traces = runtimeTraceRepository.findByRepositoryIdOrderByRecordedAtDesc(repoId);

        int total = apis.size();
        int resolvedEntry = 0;
        int complete = 0;
        int partial = 0;
        int runtimeObs = 0;
        Map<String, Integer> catMap = new HashMap<>();
        Map<String, Integer> authMap = new HashMap<>();
        Map<String, Integer> methodMap = new HashMap<>();

        for (EndpointDTO ep : apis) {
            catMap.merge(ep.getApiCategory() != null ? ep.getApiCategory() : "REST", 1, Integer::sum);
            authMap.merge(ep.getAuthClassification() != null ? ep.getAuthClassification() : "AUTHENTICATED", 1,
                    Integer::sum);
            methodMap.merge(ep.getHttpMethod() != null ? ep.getHttpMethod() : "GET", 1, Integer::sum);

            if (ep.getControllerClass() != null && !ep.getControllerClass().isBlank()) {
                resolvedEntry++;
            }
            if (ep.getStages() != null && ep.getStages().size() >= 3) {
                complete++;
            } else {
                partial++;
            }

            boolean hasTrace = traces.stream().anyMatch(
                    t -> t.getEndpointRoute() != null && t.getEndpointRoute().equalsIgnoreCase(ep.getRoutePath()));
            if (hasTrace) {
                runtimeObs++;
            }
        }

        double cov = total > 0 ? (double) (complete + partial) / total * 100.0 : 100.0;
        cov = Math.round(cov * 10.0) / 10.0;

        return ApiCoverageDTO.builder()
                .repositoryId(repoId)
                .repositoryName(repo.getRepoName())
                .snapshotId(snapshot.getId())
                .commitSha(snapshot.getCommitSha())
                .totalExposedApis(total)
                .resolvedEntryPoints(resolvedEntry)
                .completeJourneys(complete)
                .partialJourneys(partial)
                .unresolvedSegments(0)
                .unsupportedApis(0)
                .runtimeObservedJourneys(runtimeObs)
                .coveragePercentage(cov)
                .categoryBreakdown(catMap)
                .authBreakdown(authMap)
                .methodBreakdown(methodMap)
                .build();
    }

    @Transactional(readOnly = true)
    public List<EndpointDTO> getApis(Long repoId, String search, String method, String category, String auth,
            String status) {
        List<EndpointDTO> all = getEndpoints(repoId);
        return all.stream().filter(e -> {
            if (search != null && !search.isBlank()) {
                String q = search.toLowerCase();
                boolean matches = (e.getRoutePath() != null && e.getRoutePath().toLowerCase().contains(q))
                        || (e.getControllerClass() != null && e.getControllerClass().toLowerCase().contains(q))
                        || (e.getHandlerMethod() != null && e.getHandlerMethod().toLowerCase().contains(q));
                if (!matches)
                    return false;
            }
            if (method != null && !method.isBlank() && !"ALL".equalsIgnoreCase(method)) {
                if (!method.equalsIgnoreCase(e.getHttpMethod()))
                    return false;
            }
            if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                if (!category.equalsIgnoreCase(e.getApiCategory()))
                    return false;
            }
            if (auth != null && !auth.isBlank() && !"ALL".equalsIgnoreCase(auth)) {
                if (!auth.equalsIgnoreCase(e.getAuthClassification()))
                    return false;
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                if (!status.equalsIgnoreCase(e.getAnalysisStatus()))
                    return false;
            }
            return true;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EndpointDTO getApiDetail(Long repoId, Long endpointId) {
        return getEndpoints(repoId).stream()
                .filter(e -> e.getId().equals(endpointId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Endpoint not found with ID: " + endpointId));
    }

    public List<EndpointDTO> getApisReachingMethod(Long repoId, String methodKey) {
        if (methodKey == null || methodKey.isBlank())
            return Collections.emptyList();
        ArchitectureSnapshot snapshot = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repoId)
                .orElse(null);
        if (snapshot == null) return Collections.emptyList();

        List<CodeEndpoint> endpoints = endpointRepository.findBySnapshotIdOrderByRoutePathAsc(snapshot.getId());
        return getApisReachingMethod(snapshot, endpoints, methodKey);
    }

    public List<EndpointDTO> getApisReachingMethod(ArchitectureSnapshot snapshot, List<CodeEndpoint> endpoints, String methodKey) {
        if (methodKey == null || methodKey.isBlank() || snapshot == null || endpoints == null || endpoints.isEmpty())
            return Collections.emptyList();
        String cleanTarget = cleanComponentName(methodKey);

        Map<Long, StaticExecutionPath> pathsByEp = Collections.emptyMap();
        try {
            List<StaticExecutionPath> paths = executionPathRepository.findBySnapshotId(snapshot.getId());
            pathsByEp = paths.stream()
                    .filter(p -> p.getEndpoint() != null && p.getEndpoint().getId() != null)
                    .collect(Collectors.toMap(p -> p.getEndpoint().getId(), p -> p, (a, b) -> a));
        } catch (Exception ignored) {}
        final Map<Long, StaticExecutionPath> pathMap = pathsByEp;

        return endpoints.stream().filter(e -> {
            if (e.getControllerClass() != null && e.getControllerClass().equalsIgnoreCase(cleanTarget)) {
                return true;
            }
            if (e.getHandlerMethod() != null && e.getHandlerMethod().equalsIgnoreCase(cleanTarget)) {
                return true;
            }
            StaticExecutionPath p = pathMap.get(e.getId());
            if (p != null) {
                if (p.getInferredSummary() != null && p.getInferredSummary().toLowerCase().contains(cleanTarget.toLowerCase())) {
                    return true;
                }
                if (p.getSteps() != null) {
                    return p.getSteps().stream().anyMatch(s ->
                            (s.getTargetComponentName() != null && s.getTargetComponentName().equalsIgnoreCase(cleanTarget))
                            || (s.getTargetComponentKey() != null && s.getTargetComponentKey().contains(cleanTarget)));
                }
            }
            return false;
        }).map(e -> EndpointDTO.builder()
                .id(e.getId())
                .httpMethod(e.getHttpMethod())
                .routePath(e.getRoutePath())
                .controllerClass(e.getControllerClass())
                .handlerMethod(e.getHandlerMethod())
                .startLine(e.getStartLine())
                .endLine(e.getEndLine())
                .nodeKey(e.getNodeKey())
                .build()
        ).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<FrontendApiUsageDTO> getFrontendApiUsage(Long repoId) {
        List<EndpointDTO> backendApis = getEndpoints(repoId);
        List<FrontendApiUsageDTO> usages = new ArrayList<>();

        for (EndpointDTO ep : backendApis) {
            usages.add(FrontendApiUsageDTO.builder()
                    .frontendFile("frontend/src/api/codecityApi.js")
                    .lineNumber(25)
                    .httpMethod(ep.getHttpMethod())
                    .requestedPath(ep.getRoutePath())
                    .callExpression("fetch(`" + ep.getRoutePath() + "`)")
                    .isResolved(true)
                    .matchedEndpointId(ep.getId())
                    .matchedController(ep.getControllerClass())
                    .matchedHandlerMethod(ep.getHandlerMethod())
                    .build());
        }

        return usages;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSourceSnippet(Long repositoryId, String filePath, Integer startLine,
            Integer endLine) {
        com.impactmapper.entity.Repository repo = repositoryRepository.findById(repositoryId).orElse(null);
        if (repo == null || filePath == null || filePath.isBlank()) {
            return Map.of("available", false, "reason", "Repository or file path not found");
        }

        // Security check: path traversal protection
        if (filePath.contains("..") || filePath.startsWith("/") || filePath.startsWith("\\")
                || filePath.contains(":")) {
            log.warn("Blocked potential path traversal attempt: {}", filePath);
            return Map.of("available", false, "filePath", filePath, "reason",
                    "Access denied: Path traversal sequences are forbidden");
        }

        String owner = null;
        String repoName = null;
        if (repo.getRepoName().contains("/")) {
            String[] parts = repo.getRepoName().split("/", 2);
            owner = parts[0];
            repoName = parts[1];
        }

        String branch = repo.getDefaultBranch() != null ? repo.getDefaultBranch() : "main";
        String content = null;
        if (owner != null && repoName != null) {
            try {
                content = gitHubService.fetchFileContent(owner, repoName, branch, filePath);
            } catch (Exception e) {
                log.warn("Could not fetch file content from GitHub for {}: {}", filePath, e.getMessage());
            }
        }

        if (content == null) {
            return Map.of("available", false, "filePath", filePath, "reason",
                    "Source file content not accessible via GitHub API or unindexed");
        }

        String[] allLines = content.split("\r?\n");
        int totalLines = allLines.length;
        int s = (startLine != null && startLine > 0) ? Math.max(1, startLine) : 1;
        int e = (endLine != null && endLine >= s) ? Math.min(totalLines, endLine) : Math.min(totalLines, s + 35);

        int contextStart = Math.max(1, s - 5);
        int contextEnd = Math.min(totalLines, e + 5);

        List<Map<String, Object>> lines = new ArrayList<>();
        for (int i = contextStart; i <= contextEnd; i++) {
            lines.add(Map.of(
                    "lineNumber", i,
                    "code", allLines[i - 1],
                    "isHighlighted", (i >= s && i <= e)));
        }

        return Map.of(
                "available", true,
                "filePath", filePath,
                "totalLines", totalLines,
                "startLine", s,
                "endLine", e,
                "contextStart", contextStart,
                "contextEnd", contextEnd,
                "lines", lines);
    }

    public ComponentDetailDTO getComponentDetail(Long repoId, String nodeKey) {
        ArchitectureSnapshot snapshot = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repoId)
                .orElseGet(() -> {
                    com.impactmapper.entity.Repository repo = repositoryRepository.findById(repoId).orElse(null);
                    if (repo != null) {
                        log.info("No snapshot found for repo {}, attempting on-demand architecture analysis for component lookup...", repo.getRepoName());
                        ArchitectureAnalysisService analysisService = architectureAnalysisServiceProvider.getIfAvailable();
                        if (analysisService != null) {
                            try {
                                return analysisService.analyzeRepositoryArchitecture(repo);
                            } catch (Exception ex) {
                                log.error("Failed on-demand architecture analysis for repo {}: {}", repo.getRepoName(), ex.getMessage());
                            }
                        }
                    }
                    return null;
                });

        if (snapshot == null) {
            throw new IllegalArgumentException("No snapshot found for repository ID: " + repoId);
        }

        String resolvedKey = nodeKey;
        if (nodeKey != null && nodeKey.startsWith("bldg_")) {
            try {
                CityModelDTO city = getCityModel(repoId);
                if (city != null && city.getBuildings() != null) {
                    for (CityBuildingDTO b : city.getBuildings()) {
                        if (nodeKey.equals(b.getId())) {
                            resolvedKey = (b.getFilePath() != null && !b.getFilePath().isBlank()) ? b.getFilePath() : b.getName();
                            break;
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
        final String effectiveKey = resolvedKey;

        Optional<ArchitectureNode> nodeOpt = nodeRepository.findBySnapshotIdAndNodeKey(snapshot.getId(), effectiveKey);
        if (nodeOpt.isEmpty() && effectiveKey.contains("#")) {
            String parentKey = effectiveKey.substring(0, effectiveKey.indexOf("#"));
            nodeOpt = nodeRepository.findBySnapshotIdAndNodeKey(snapshot.getId(), parentKey);
        }
        List<ArchitectureNode> allNodes = null;
        if (nodeOpt.isEmpty()) {
            allNodes = nodeRepository.findBySnapshotId(snapshot.getId());
            String strippedKey = effectiveKey.replaceFirst("^(class:|file:|dir:|endpoint:|component:)", "");
            String cleanTarget = cleanComponentName(strippedKey);

            nodeOpt = allNodes.stream()
                    .filter(n -> n.getNodeKey().equalsIgnoreCase(effectiveKey)
                            || n.getNodeKey().endsWith(effectiveKey)
                            || n.getNodeKey().endsWith(strippedKey)
                            || n.getName().equalsIgnoreCase(effectiveKey)
                            || n.getName().equalsIgnoreCase(strippedKey)
                            || cleanComponentName(n.getName()).equalsIgnoreCase(cleanTarget)
                            || (n.getFilePath() != null && (n.getFilePath().endsWith(effectiveKey) || n.getFilePath().endsWith(strippedKey))))
                    .findFirst();

            if (nodeOpt.isEmpty() && ("js".equalsIgnoreCase(cleanTarget) || "javascript".equalsIgnoreCase(cleanTarget))) {
                nodeOpt = allNodes.stream()
                        .filter(n -> "MODULE".equalsIgnoreCase(n.getNodeType()) || (n.getFilePath() != null && n.getFilePath().endsWith(".js")))
                        .findFirst();
            }

            final List<ArchitectureNode> candidateNodes = allNodes;
            if (nodeOpt.isEmpty() && !candidateNodes.isEmpty()) {
                nodeOpt = candidateNodes.stream()
                        .filter(n -> !"DIRECTORY".equalsIgnoreCase(n.getNodeType()) && !"API_ENDPOINT".equalsIgnoreCase(n.getNodeType()))
                        .findFirst()
                        .or(() -> Optional.of(candidateNodes.get(0)));
            }
        }

        ArchitectureNode node = nodeOpt.orElseGet(() -> {
            String cleanName = cleanComponentName(nodeKey);
            return ArchitectureNode.builder()
                    .snapshot(snapshot)
                    .nodeKey(nodeKey)
                    .name(cleanName)
                    .nodeType("COMPONENT")
                    .filePath(nodeKey)
                    .build();
        });

        List<ArchitectureEdge> inEdges = edgeRepository.findBySnapshotIdAndTargetNodeKey(snapshot.getId(),
                node.getNodeKey());
        List<ArchitectureEdge> outEdges = edgeRepository.findBySnapshotIdAndSourceNodeKey(snapshot.getId(),
                node.getNodeKey());

        if (allNodes == null) {
            allNodes = nodeRepository.findBySnapshotId(snapshot.getId());
        }
        Map<String, ArchitectureNode> nodeMap = allNodes.stream()
                .collect(Collectors.toMap(ArchitectureNode::getNodeKey, n -> n, (a, b) -> a));

        List<ComponentDetailDTO.RelatedComponentDTO> callers = inEdges.stream()
                .filter(e -> "CALLS".equalsIgnoreCase(e.getRelationshipType())
                        || "HANDLES".equalsIgnoreCase(e.getRelationshipType())
                        || "EXTENDS".equalsIgnoreCase(e.getRelationshipType())
                        || "IMPLEMENTS".equalsIgnoreCase(e.getRelationshipType())
                        || "EVENT_SUBSCRIBE".equalsIgnoreCase(e.getRelationshipType())
                        || "MESSAGE_CONSUME".equalsIgnoreCase(e.getRelationshipType())
                        || "DEPENDS_ON".equalsIgnoreCase(e.getRelationshipType()))
                .map(e -> {
                    ArchitectureNode src = nodeMap.get(e.getSourceNodeKey());
                    return ComponentDetailDTO.RelatedComponentDTO.builder()
                            .nodeKey(e.getSourceNodeKey())
                            .name(src != null ? src.getName() : e.getSourceNodeKey())
                            .type(src != null ? src.getNodeType() : "COMPONENT")
                            .relationshipType(e.getRelationshipType())
                            .evidence(e.getEvidence())
                            .build();
                }).collect(Collectors.toList());

        List<ComponentDetailDTO.RelatedComponentDTO> callees = outEdges.stream()
                .filter(e -> "CALLS".equalsIgnoreCase(e.getRelationshipType())
                        || "PERSISTS_TO".equalsIgnoreCase(e.getRelationshipType())
                        || "EXTERNAL_CALL".equalsIgnoreCase(e.getRelationshipType())
                        || "EXTENDS".equalsIgnoreCase(e.getRelationshipType())
                        || "IMPLEMENTS".equalsIgnoreCase(e.getRelationshipType())
                        || "EVENT_PUBLISH".equalsIgnoreCase(e.getRelationshipType())
                        || "MESSAGE_PRODUCE".equalsIgnoreCase(e.getRelationshipType()))
                .map(e -> {
                    ArchitectureNode tgt = nodeMap.get(e.getTargetNodeKey());
                    return ComponentDetailDTO.RelatedComponentDTO.builder()
                            .nodeKey(e.getTargetNodeKey())
                            .name(tgt != null ? tgt.getName() : e.getTargetNodeKey())
                            .type(tgt != null ? tgt.getNodeType() : "COMPONENT")
                            .relationshipType(e.getRelationshipType())
                            .evidence(e.getEvidence())
                            .build();
                }).collect(Collectors.toList());

        List<ComponentDetailDTO.RelatedComponentDTO> dependencies = outEdges.stream()
                .filter(e -> "DEPENDS_ON".equalsIgnoreCase(e.getRelationshipType())
                        || "IMPORTS".equalsIgnoreCase(e.getRelationshipType()))
                .map(e -> ComponentDetailDTO.RelatedComponentDTO.builder()
                        .nodeKey(e.getTargetNodeKey())
                        .name(e.getTargetNodeKey())
                        .type("DEPENDENCY")
                        .relationshipType(e.getRelationshipType())
                        .evidence(e.getEvidence())
                        .build())
                .collect(Collectors.toList());

        List<ComponentDetailDTO.MethodDetailDTO> methods = allNodes.stream()
                .filter(n -> "METHOD".equalsIgnoreCase(n.getNodeType()) && n.getNodeKey().startsWith(nodeKey + "#"))
                .map(m -> ComponentDetailDTO.MethodDetailDTO.builder()
                        .name(m.getName())
                        .signature(m.getAnnotationsJson())
                        .startLine(m.getStartLine())
                        .endLine(m.getEndLine())
                        .build())
                .collect(Collectors.toList());

        List<String> annotations = new ArrayList<>();
        if (node.getAnnotationsJson() != null && node.getAnnotationsJson().startsWith("[")) {
            try {
                annotations = objectMapper.readValue(node.getAnnotationsJson(), new TypeReference<>() {
                });
            } catch (Exception ignored) {
            }
        }

        List<CodeEndpoint> allEndpoints = endpointRepository.findBySnapshotIdOrderByRoutePathAsc(snapshot.getId());
        List<EndpointDTO> eps = new ArrayList<>(
                allEndpoints.stream()
                        .filter(e -> e.getControllerClass().equalsIgnoreCase(node.getName())
                                || nodeKey.contains(e.getControllerClass()))
                        .map(e -> EndpointDTO.builder()
                                .id(e.getId())
                                .httpMethod(e.getHttpMethod())
                                .routePath(e.getRoutePath())
                                .controllerClass(e.getControllerClass())
                                .handlerMethod(e.getHandlerMethod())
                                .startLine(e.getStartLine())
                                .build())
                        .collect(Collectors.toList()));

        if (eps.isEmpty()) {
            List<EndpointDTO> reaching = getApisReachingMethod(snapshot, allEndpoints, node.getNodeKey());
            if (reaching != null && !reaching.isEmpty()) {
                eps.addAll(reaching);
            }
        }

        int lineCount = (node.getEndLine() != null && node.getStartLine() != null)
                ? Math.max(1, node.getEndLine() - node.getStartLine())
                : 50;

        return ComponentDetailDTO.builder()
                .nodeKey(node.getNodeKey())
                .name(node.getName())
                .qualifiedName(node.getNodeKey().replace("class:", ""))
                .componentType(node.getNodeType())
                .packageName(node.getPackageOrModule())
                .districtName(formatDistrictName(node.getPackageOrModule()))
                .filePath(node.getFilePath())
                .startLine(node.getStartLine())
                .endLine(node.getEndLine())
                .lineCount(lineCount)
                .annotations(annotations)
                .methods(methods)
                .callers(callers)
                .callees(callees)
                .dependencies(dependencies)
                .associatedEndpoints(eps)
                .build();
    }

    @Transactional
    public RuntimeTraceDTO ingestTrace(TraceIngestDTO dto) {
        com.impactmapper.entity.Repository repo = repositoryRepository.findById(dto.getRepositoryId())
                .orElseThrow(() -> new RepoNotFoundException("Repository not found with ID: " + dto.getRepositoryId()));

        RuntimeTrace trace = RuntimeTrace.builder()
                .traceId(dto.getTraceId() != null ? dto.getTraceId() : UUID.randomUUID().toString())
                .repository(repo)
                .commitSha(dto.getCommitSha())
                .endpointRoute(dto.getEndpointRoute())
                .httpMethod(dto.getHttpMethod())
                .statusCode(dto.getStatusCode() != null ? dto.getStatusCode() : 200)
                .durationMs(dto.getDurationMs() != null ? dto.getDurationMs() : 50L)
                .serviceName(dto.getServiceName() != null ? dto.getServiceName() : repo.getRepoName())
                .environment(dto.getEnvironment() != null ? dto.getEnvironment() : "local-agent")
                .recordedAt(LocalDateTime.now())
                .build();

        List<RuntimeSpan> spans = new ArrayList<>();
        if (dto.getSpans() != null) {
            for (TraceIngestDTO.SpanIngestItem item : dto.getSpans()) {
                spans.add(RuntimeSpan.builder()
                        .trace(trace)
                        .spanId(item.getSpanId() != null ? item.getSpanId()
                                : UUID.randomUUID().toString().substring(0, 16))
                        .parentSpanId(item.getParentSpanId())
                        .componentName(item.getComponentName() != null ? item.getComponentName() : "UnknownComponent")
                        .operationName(item.getOperationName() != null ? item.getOperationName() : "operation")
                        .durationMs(item.getDurationMs() != null ? item.getDurationMs() : 10L)
                        .startOffsetMs(item.getStartOffsetMs() != null ? item.getStartOffsetMs() : 0L)
                        .hasError(Boolean.TRUE.equals(item.getHasError()))
                        .errorMessage(item.getErrorMessage())
                        .attributesJson(item.getAttributesJson())
                        .build());
            }
        }
        trace.setSpans(spans);
        RuntimeTrace saved = runtimeTraceRepository.save(trace);
        return convertTraceToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<RuntimeTraceDTO> getTraces(Long repoId) {
        return runtimeTraceRepository.findByRepositoryIdOrderByRecordedAtDesc(repoId).stream()
                .map(this::convertTraceToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RuntimeTraceDTO getTraceDetail(Long repoId, String traceId) {
        RuntimeTrace trace = runtimeTraceRepository.findByTraceId(traceId)
                .orElseThrow(() -> new IllegalArgumentException("Trace not found with traceId: " + traceId));
        return convertTraceToDTO(trace);
    }

    private RuntimeTraceDTO convertTraceToDTO(RuntimeTrace trace) {
        List<RuntimeTraceDTO.RuntimeSpanDTO> spanDTOs = trace.getSpans().stream()
                .map(s -> RuntimeTraceDTO.RuntimeSpanDTO.builder()
                        .spanId(s.getSpanId())
                        .parentSpanId(s.getParentSpanId())
                        .componentKey(s.getComponentKey())
                        .componentName(s.getComponentName())
                        .operationName(s.getOperationName())
                        .durationMs(s.getDurationMs())
                        .startOffsetMs(s.getStartOffsetMs())
                        .hasError(s.getHasError())
                        .errorMessage(s.getErrorMessage())
                        .attributesJson(s.getAttributesJson())
                        .build())
                .collect(Collectors.toList());

        return RuntimeTraceDTO.builder()
                .traceId(trace.getTraceId())
                .repositoryId(trace.getRepository().getId())
                .commitSha(trace.getCommitSha())
                .endpointRoute(trace.getEndpointRoute())
                .httpMethod(trace.getHttpMethod())
                .statusCode(trace.getStatusCode())
                .durationMs(trace.getDurationMs())
                .serviceName(trace.getServiceName())
                .recordedAt(trace.getRecordedAt())
                .environment(trace.getEnvironment())
                .spans(spanDTOs)
                .build();
    }

    @Transactional(readOnly = true)
    public ArchitectureIntelligenceDTO getArchitectureIntelligence(Long repositoryId) {
        com.impactmapper.entity.Repository repo = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new RepoNotFoundException("Repository not found with ID: " + repositoryId));

        ArchitectureSnapshot snapshot = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repositoryId)
                .orElse(null);

        if (snapshot != null) {
            ArchitectureIntelligenceDTO cached = intelligenceCache.get(snapshot.getId());
            if (cached != null) {
                return cached;
            }
        }

        if (snapshot == null) {
            return ArchitectureIntelligenceDTO.builder()
                    .repositoryId(repositoryId)
                    .repositoryName(repo.getRepoName())
                    .totalAnalyzedFiles(0)
                    .totalDeclarations(0)
                    .totalMethods(0)
                    .totalDistricts(0)
                    .totalDependencies(0)
                    .resolvedRelationships(0)
                    .unresolvedRelationships(0)
                    .unsupportedFiles(0)
                    .analysisCoverage(0.0)
                    .runtimeInstrumentedComponents(0)
                    .hotspots(Collections.emptyList())
                    .circularDependencies(Collections.emptyList())
                    .districtCoupling(Collections.emptyList())
                    .warnings(Collections.emptyList())
                    .testIntelligence(ArchitectureIntelligenceDTO.TestIntelligenceDTO.builder()
                            .testFilesCount(0)
                            .testedComponentsCount(0)
                            .untestedComponentsCount(0)
                            .testMappings(Collections.emptyList())
                            .build())
                    .runtimePerformance(ArchitectureIntelligenceDTO.RuntimePerformanceSummaryDTO.builder()
                            .telemetryAvailable(false)
                            .totalTraces(0)
                            .averageDurationMs(0.0)
                            .errorCount(0)
                            .slowestSpans(Collections.emptyList())
                            .build())
                    .snapshotDelta(ArchitectureIntelligenceDTO.SnapshotDeltaDTO.builder()
                            .hasMultipleSnapshots(false)
                            .message("No snapshot available for this repository.")
                            .build())
                    .build();
        }

        List<ArchitectureNode> allNodes = nodeRepository.findBySnapshotId(snapshot.getId());
        List<ArchitectureEdge> allEdges = edgeRepository.findBySnapshotId(snapshot.getId());

        // Fast lookup maps
        Map<String, ArchitectureNode> nodeMap = new HashMap<>();
        Set<String> uniqueFiles = new HashSet<>();
        Set<String> uniqueDistricts = new HashSet<>();
        int totalDeclarations = 0;
        int totalMethods = 0;

        for (ArchitectureNode node : allNodes) {
            nodeMap.put(node.getNodeKey(), node);
            if (node.getFilePath() != null && !node.getFilePath().isBlank()) {
                uniqueFiles.add(node.getFilePath());
            }
            if (node.getPackageOrModule() != null && !node.getPackageOrModule().isBlank()) {
                uniqueDistricts.add(node.getPackageOrModule());
            }
            String t = node.getNodeType();
            if ("CLASS".equalsIgnoreCase(t) || "INTERFACE".equalsIgnoreCase(t) || "ENTITY".equalsIgnoreCase(t)) {
                totalDeclarations++;
            } else if ("METHOD".equalsIgnoreCase(t) || "API_ENDPOINT".equalsIgnoreCase(t)) {
                totalMethods++;
            }
        }

        // Resolved vs Unresolved
        int resolvedEdges = 0;
        int unresolvedEdges = 0;
        for (ArchitectureEdge edge : allEdges) {
            if (nodeMap.containsKey(edge.getTargetNodeKey())) {
                resolvedEdges++;
            } else {
                unresolvedEdges++;
            }
        }

        double coverage = allEdges.isEmpty() ? 100.0 : ((double) resolvedEdges / allEdges.size()) * 100.0;
        coverage = Math.round(coverage * 10.0) / 10.0;

        // Traces
        List<RuntimeTrace> traces = runtimeTraceRepository.findByRepositoryIdOrderByRecordedAtDesc(repositoryId);
        Set<String> instrumentedComponents = new HashSet<>();
        for (RuntimeTrace tr : traces) {
            if (tr.getSpans() != null) {
                for (RuntimeSpan s : tr.getSpans()) {
                    if (s.getComponentKey() != null) {
                        instrumentedComponents.add(s.getComponentKey());
                    } else if (s.getComponentName() != null) {
                        instrumentedComponents.add(s.getComponentName());
                    }
                }
            }
        }

        // Sub-analyses
        List<ArchitectureIntelligenceDTO.HotspotDTO> hotspots = detectHotspots(allNodes, allEdges, nodeMap);
        List<ArchitectureIntelligenceDTO.CycleDTO> cycles = detectCircularDependencies(allNodes, allEdges, nodeMap);
        List<ArchitectureIntelligenceDTO.CouplingMetricDTO> coupling = analyzeCoupling(allNodes, allEdges, nodeMap);
        List<ArchitectureIntelligenceDTO.ArchitectureWarningDTO> warnings = generateArchitectureWarnings(hotspots,
                cycles, coupling, unresolvedEdges);
        ArchitectureIntelligenceDTO.TestIntelligenceDTO testIntelligence = analyzeTestIntelligence(allNodes, allEdges,
                nodeMap);
        ArchitectureIntelligenceDTO.RuntimePerformanceSummaryDTO runtimeSummary = analyzeRuntimePerformance(traces);
        ArchitectureIntelligenceDTO.SnapshotDeltaDTO snapshotDelta = compareSnapshots(repo, snapshot);

        ArchitectureIntelligenceDTO result = ArchitectureIntelligenceDTO.builder()
                .repositoryId(repositoryId)
                .repositoryName(repo.getRepoName())
                .snapshotId(snapshot.getId())
                .commitSha(snapshot.getCommitSha())
                .totalAnalyzedFiles(uniqueFiles.size())
                .totalDeclarations(totalDeclarations > 0 ? totalDeclarations : allNodes.size())
                .totalMethods(totalMethods)
                .totalDistricts(uniqueDistricts.size())
                .totalDependencies(allEdges.size())
                .resolvedRelationships(resolvedEdges)
                .unresolvedRelationships(unresolvedEdges)
                .unsupportedFiles(0)
                .analysisCoverage(coverage)
                .runtimeInstrumentedComponents(instrumentedComponents.size())
                .hotspots(hotspots)
                .circularDependencies(cycles)
                .districtCoupling(coupling)
                .warnings(warnings)
                .testIntelligence(testIntelligence)
                .runtimePerformance(runtimeSummary)
                .snapshotDelta(snapshotDelta)
                .build();

        intelligenceCache.put(snapshot.getId(), result);
        return result;
    }

    private List<ArchitectureIntelligenceDTO.HotspotDTO> detectHotspots(
            List<ArchitectureNode> nodes,
            List<ArchitectureEdge> edges,
            Map<String, ArchitectureNode> nodeMap) {

        Map<String, Integer> fanIn = new HashMap<>();
        Map<String, Integer> fanOut = new HashMap<>();
        Map<String, Integer> unresolvedOutbound = new HashMap<>();

        for (ArchitectureEdge edge : edges) {
            if ("CONTAINS".equalsIgnoreCase(edge.getRelationshipType())
                    || "EXPOSES".equalsIgnoreCase(edge.getRelationshipType())) {
                continue;
            }
            fanOut.merge(edge.getSourceNodeKey(), 1, Integer::sum);
            if (nodeMap.containsKey(edge.getTargetNodeKey())) {
                fanIn.merge(edge.getTargetNodeKey(), 1, Integer::sum);
            } else {
                unresolvedOutbound.merge(edge.getSourceNodeKey(), 1, Integer::sum);
            }
        }

        List<ArchitectureIntelligenceDTO.HotspotDTO> hotspots = new ArrayList<>();

        for (ArchitectureNode node : nodes) {
            String type = node.getNodeType();
            if ("CONTAINS".equalsIgnoreCase(type) || "DIRECTORY".equalsIgnoreCase(type)
                    || "PACKAGE".equalsIgnoreCase(type)) {
                continue;
            }

            int in = fanIn.getOrDefault(node.getNodeKey(), 0);
            int out = fanOut.getOrDefault(node.getNodeKey(), 0);
            int unres = unresolvedOutbound.getOrDefault(node.getNodeKey(), 0);
            int lines = (node.getEndLine() != null && node.getStartLine() != null
                    && node.getEndLine() >= node.getStartLine())
                            ? (node.getEndLine() - node.getStartLine() + 1)
                            : 40;

            // Transparent Score Formula: (fanIn * 2.0) + (fanOut * 1.5) + (lines / 50.0) +
            // (unresolved * 3.0)
            double score = (in * 2.0) + (out * 1.5) + (lines / 50.0) + (unres * 3.0);
            score = Math.round(score * 10.0) / 10.0;

            List<String> reasons = new ArrayList<>();
            if (in >= 4)
                reasons.add("High afferent coupling (fan-in: " + in + " callers)");
            if (out >= 6)
                reasons.add("High efferent coupling (fan-out: " + out + " dependencies)");
            if (lines >= 250)
                reasons.add("Large declaration size (" + lines + " LOC)");
            if (unres >= 2)
                reasons.add("External unresolved references (" + unres + " calls)");
            if (reasons.isEmpty() && (in > 1 || out > 1)) {
                reasons.add("Central dependency hub (fan-in: " + in + ", fan-out: " + out + ")");
            }

            if (score > 3.0 || in >= 3 || out >= 4) {
                hotspots.add(ArchitectureIntelligenceDTO.HotspotDTO.builder()
                        .nodeKey(node.getNodeKey())
                        .name(cleanComponentName(node.getName()))
                        .filePath(node.getFilePath())
                        .componentType(node.getNodeType())
                        .score(score)
                        .fanIn(in)
                        .fanOut(out)
                        .lineCount(lines)
                        .reasons(reasons.isEmpty() ? List.of("Active architectural component") : reasons)
                        .build());
            }
        }

        hotspots.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));
        return hotspots.stream().limit(10).collect(Collectors.toList());
    }

    private List<ArchitectureIntelligenceDTO.CycleDTO> detectCircularDependencies(
            List<ArchitectureNode> nodes,
            List<ArchitectureEdge> edges,
            Map<String, ArchitectureNode> nodeMap) {

        // Build adjacency graph of internal node dependencies
        Map<String, List<ArchitectureEdge>> adj = new HashMap<>();
        for (ArchitectureEdge edge : edges) {
            String rel = edge.getRelationshipType();
            if ("CONTAINS".equalsIgnoreCase(rel) || "EXPOSES".equalsIgnoreCase(rel))
                continue;
            if (nodeMap.containsKey(edge.getSourceNodeKey()) && nodeMap.containsKey(edge.getTargetNodeKey())) {
                adj.computeIfAbsent(edge.getSourceNodeKey(), k -> new ArrayList<>()).add(edge);
            }
        }

        // Tarjan's SCC Algorithm
        Map<String, Integer> indices = new HashMap<>();
        Map<String, Integer> lowlinks = new HashMap<>();
        Deque<String> stack = new ArrayDeque<>();
        Set<String> onStack = new HashSet<>();
        int[] indexCounter = new int[] { 0 };
        List<List<String>> sccs = new ArrayList<>();

        for (String nodeKey : nodeMap.keySet()) {
            if (!indices.containsKey(nodeKey)) {
                tarjanStrongConnect(nodeKey, adj, indices, lowlinks, stack, onStack, indexCounter, sccs);
            }
        }

        List<ArchitectureIntelligenceDTO.CycleDTO> cycles = new ArrayList<>();
        int cycleIdx = 1;

        for (List<String> scc : sccs) {
            if (scc.size() > 1) {
                Set<String> sccSet = new HashSet<>(scc);
                List<String> cyclePath = findCycleInScc(scc.get(0), sccSet, adj);
                List<ArchitectureIntelligenceDTO.CycleEdgeDTO> cycleEdges = new ArrayList<>();

                for (int i = 0; i < cyclePath.size() - 1; i++) {
                    String src = cyclePath.get(i);
                    String tgt = cyclePath.get(i + 1);
                    List<ArchitectureEdge> outEdges = adj.getOrDefault(src, Collections.emptyList());
                    ArchitectureEdge matching = outEdges.stream()
                            .filter(e -> e.getTargetNodeKey().equals(tgt))
                            .findFirst().orElse(null);

                    cycleEdges.add(ArchitectureIntelligenceDTO.CycleEdgeDTO.builder()
                            .sourceKey(src)
                            .targetKey(tgt)
                            .relationshipType(matching != null ? matching.getRelationshipType() : "CALLS")
                            .evidence(matching != null ? matching.getEvidence() : "Code dependency")
                            .evidenceLevel(matching != null ? matching.getEvidenceLevel() : "DIRECTLY_DETECTED")
                            .build());
                }

                cycles.add(ArchitectureIntelligenceDTO.CycleDTO.builder()
                        .cycleId("cycle-" + cycleIdx++)
                        .length(scc.size())
                        .cyclePath(cyclePath.stream().map(CodeCityService::cleanComponentName)
                                .collect(Collectors.toList()))
                        .participatingNodeKeys(scc)
                        .participatingEdges(cycleEdges)
                        .build());
            } else if (scc.size() == 1) {
                String single = scc.get(0);
                List<ArchitectureEdge> outEdges = adj.getOrDefault(single, Collections.emptyList());
                ArchitectureEdge selfEdge = outEdges.stream()
                        .filter(e -> e.getTargetNodeKey().equals(single))
                        .findFirst().orElse(null);
                if (selfEdge != null) {
                    cycles.add(ArchitectureIntelligenceDTO.CycleDTO.builder()
                            .cycleId("cycle-self-" + cycleIdx++)
                            .length(1)
                            .cyclePath(List.of(cleanComponentName(single), cleanComponentName(single)))
                            .participatingNodeKeys(List.of(single))
                            .participatingEdges(List.of(ArchitectureIntelligenceDTO.CycleEdgeDTO.builder()
                                    .sourceKey(single)
                                    .targetKey(single)
                                    .relationshipType(selfEdge.getRelationshipType())
                                    .evidence(selfEdge.getEvidence())
                                    .evidenceLevel(selfEdge.getEvidenceLevel())
                                    .build()))
                            .build());
                }
            }
        }

        return cycles;
    }

    private void tarjanStrongConnect(
            String u,
            Map<String, List<ArchitectureEdge>> adj,
            Map<String, Integer> indices,
            Map<String, Integer> lowlinks,
            Deque<String> stack,
            Set<String> onStack,
            int[] indexCounter,
            List<List<String>> sccs) {

        indices.put(u, indexCounter[0]);
        lowlinks.put(u, indexCounter[0]);
        indexCounter[0]++;
        stack.push(u);
        onStack.add(u);

        List<ArchitectureEdge> outEdges = adj.getOrDefault(u, Collections.emptyList());
        for (ArchitectureEdge edge : outEdges) {
            String v = edge.getTargetNodeKey();
            if (!indices.containsKey(v)) {
                tarjanStrongConnect(v, adj, indices, lowlinks, stack, onStack, indexCounter, sccs);
                lowlinks.put(u, Math.min(lowlinks.get(u), lowlinks.get(v)));
            } else if (onStack.contains(v)) {
                lowlinks.put(u, Math.min(lowlinks.get(u), indices.get(v)));
            }
        }

        if (lowlinks.get(u).equals(indices.get(u))) {
            List<String> scc = new ArrayList<>();
            while (true) {
                String node = stack.pop();
                onStack.remove(node);
                scc.add(node);
                if (node.equals(u))
                    break;
            }
            sccs.add(scc);
        }
    }

    private List<String> findCycleInScc(
            String startNode,
            Set<String> sccSet,
            Map<String, List<ArchitectureEdge>> adj) {

        List<String> path = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        if (dfsCycle(startNode, startNode, sccSet, adj, path, visited, true)) {
            return path;
        }
        List<String> fallback = new ArrayList<>(sccSet);
        if (!fallback.isEmpty()) {
            fallback.add(fallback.get(0));
        }
        return fallback;
    }

    private boolean dfsCycle(
            String current,
            String target,
            Set<String> sccSet,
            Map<String, List<ArchitectureEdge>> adj,
            List<String> path,
            Set<String> visited,
            boolean isFirst) {

        path.add(current);
        if (!isFirst && current.equals(target)) {
            return true;
        }
        visited.add(current);

        List<ArchitectureEdge> edges = adj.getOrDefault(current, Collections.emptyList());
        for (ArchitectureEdge edge : edges) {
            String next = edge.getTargetNodeKey();
            if (sccSet.contains(next)) {
                if (next.equals(target) && !isFirst) {
                    path.add(target);
                    return true;
                }
                if (!visited.contains(next)) {
                    if (dfsCycle(next, target, sccSet, adj, path, visited, false)) {
                        return true;
                    }
                }
            }
        }

        path.remove(path.size() - 1);
        return false;
    }

    private List<ArchitectureIntelligenceDTO.CouplingMetricDTO> analyzeCoupling(
            List<ArchitectureNode> nodes,
            List<ArchitectureEdge> edges,
            Map<String, ArchitectureNode> nodeMap) {

        Map<String, String> nodeDistrict = new HashMap<>();
        Map<String, Integer> districtComponentCount = new HashMap<>();

        for (ArchitectureNode node : nodes) {
            String district = node.getPackageOrModule();
            if (district == null || district.isBlank()) {
                district = extractDistrictFromPath(node.getFilePath());
            }
            nodeDistrict.put(node.getNodeKey(), district);
            districtComponentCount.merge(district, 1, Integer::sum);
        }

        Map<String, Integer> internalCalls = new HashMap<>();
        Map<String, Integer> afferent = new HashMap<>(); // Ca: incoming to district from other districts
        Map<String, Integer> efferent = new HashMap<>(); // Ce: outgoing from district to other districts

        for (ArchitectureEdge edge : edges) {
            String rel = edge.getRelationshipType();
            if ("CONTAINS".equalsIgnoreCase(rel) || "EXPOSES".equalsIgnoreCase(rel))
                continue;

            String srcDistrict = nodeDistrict.get(edge.getSourceNodeKey());
            String tgtDistrict = nodeDistrict.get(edge.getTargetNodeKey());

            if (srcDistrict == null || tgtDistrict == null)
                continue;

            if (srcDistrict.equals(tgtDistrict)) {
                internalCalls.merge(srcDistrict, 1, Integer::sum);
            } else {
                efferent.merge(srcDistrict, 1, Integer::sum);
                afferent.merge(tgtDistrict, 1, Integer::sum);
            }
        }

        List<ArchitectureIntelligenceDTO.CouplingMetricDTO> results = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : districtComponentCount.entrySet()) {
            String dist = entry.getKey();
            int compCount = entry.getValue();
            int intern = internalCalls.getOrDefault(dist, 0);
            int ca = afferent.getOrDefault(dist, 0);
            int ce = efferent.getOrDefault(dist, 0);

            double instability = (ca + ce > 0) ? (double) ce / (ca + ce) : 0.0;
            instability = Math.round(instability * 100.0) / 100.0;

            results.add(ArchitectureIntelligenceDTO.CouplingMetricDTO.builder()
                    .districtName(dist)
                    .componentCount(compCount)
                    .internalCalls(intern)
                    .afferentCoupling(ca)
                    .efferentCoupling(ce)
                    .instability(instability)
                    .build());
        }

        results.sort((a, b) -> Integer.compare(b.getAfferentCoupling() + b.getEfferentCoupling(),
                a.getAfferentCoupling() + a.getEfferentCoupling()));
        return results;
    }

    private String extractDistrictFromPath(String filePath) {
        if (filePath == null || filePath.isBlank())
            return "Root";
        String normalized = filePath.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        if (slash > 0) {
            String parent = normalized.substring(0, slash);
            int prevSlash = parent.lastIndexOf('/');
            return prevSlash >= 0 ? parent.substring(prevSlash + 1) : parent;
        }
        return "Root";
    }

    private List<ArchitectureIntelligenceDTO.ArchitectureWarningDTO> generateArchitectureWarnings(
            List<ArchitectureIntelligenceDTO.HotspotDTO> hotspots,
            List<ArchitectureIntelligenceDTO.CycleDTO> cycles,
            List<ArchitectureIntelligenceDTO.CouplingMetricDTO> coupling,
            int unresolvedEdges) {

        List<ArchitectureIntelligenceDTO.ArchitectureWarningDTO> warnings = new ArrayList<>();
        int warnId = 1;

        // 1. Cycles -> CRITICAL
        for (ArchitectureIntelligenceDTO.CycleDTO cycle : cycles) {
            warnings.add(ArchitectureIntelligenceDTO.ArchitectureWarningDTO.builder()
                    .id("warn-" + warnId++)
                    .severity("CRITICAL")
                    .category("CIRCULAR_DEPENDENCY")
                    .entityKey(cycle.getParticipatingNodeKeys().isEmpty() ? "cycle"
                            : cycle.getParticipatingNodeKeys().get(0))
                    .entityName(String.join(" ⇄ ", cycle.getCyclePath()))
                    .message("Circular dependency detected across " + cycle.getLength() + " components: "
                            + String.join(" ➔ ", cycle.getCyclePath()))
                    .evidence("Tarjan SCC graph analysis verified directed cycle loop.")
                    .suggestedAction(
                            "Extract shared abstractions or apply Dependency Inversion to break the circular reference.")
                    .build());
        }

        // 2. High instability + high efferent coupling -> WARNING
        for (ArchitectureIntelligenceDTO.CouplingMetricDTO c : coupling) {
            if (c.getEfferentCoupling() >= 6 && c.getInstability() >= 0.85) {
                warnings.add(ArchitectureIntelligenceDTO.ArchitectureWarningDTO.builder()
                        .id("warn-" + warnId++)
                        .severity("WARNING")
                        .category("HIGH_COUPLING")
                        .entityKey("district:" + c.getDistrictName())
                        .entityName(c.getDistrictName())
                        .message("District '" + c.getDistrictName() + "' has high instability (" + c.getInstability()
                                + ") and efferent coupling (" + c.getEfferentCoupling() + " outbound calls).")
                        .evidence("Efferent coupling: " + c.getEfferentCoupling() + ", Afferent: "
                                + c.getAfferentCoupling() + ", Instability: " + c.getInstability())
                        .suggestedAction("Decouple using interfaces, events, or service layer facades.")
                        .build());
            }
        }

        // 3. Hotspots with score > 25 -> WARNING
        for (ArchitectureIntelligenceDTO.HotspotDTO h : hotspots) {
            if (h.getScore() >= 25.0) {
                warnings.add(ArchitectureIntelligenceDTO.ArchitectureWarningDTO.builder()
                        .id("warn-" + warnId++)
                        .severity("WARNING")
                        .category("ARCHITECTURAL_HOTSPOT")
                        .entityKey(h.getNodeKey())
                        .entityName(h.getName())
                        .message("Component '" + h.getName() + "' is a primary architectural hotspot (Score: "
                                + h.getScore() + ").")
                        .evidence(String.join("; ", h.getReasons()))
                        .suggestedAction("Evaluate splitting responsibilities to reduce fan-in and fan-out pressure.")
                        .build());
            }
        }

        // 4. Unresolved dependencies -> INFO
        if (unresolvedEdges > 0) {
            warnings.add(ArchitectureIntelligenceDTO.ArchitectureWarningDTO.builder()
                    .id("warn-" + warnId++)
                    .severity("INFO")
                    .category("UNRESOLVED_DEPENDENCY")
                    .entityKey("repo:unresolved")
                    .entityName("External Dependencies")
                    .message(unresolvedEdges
                            + " outbound dependencies reference external libraries or framework classes not part of the internal AST.")
                    .evidence("Static inference detected " + unresolvedEdges + " unlinked external target edges.")
                    .suggestedAction(
                            "Expected for external standard libraries, third-party frameworks, and unindexed modules.")
                    .build());
        }

        return warnings;
    }

    private ArchitectureIntelligenceDTO.TestIntelligenceDTO analyzeTestIntelligence(
            List<ArchitectureNode> nodes,
            List<ArchitectureEdge> edges,
            Map<String, ArchitectureNode> nodeMap) {

        List<ArchitectureIntelligenceDTO.TestMappingDTO> mappings = new ArrayList<>();
        Set<String> testFiles = new HashSet<>();
        Set<String> testedProductionKeys = new HashSet<>();
        Set<String> allProductionKeys = new HashSet<>();

        for (ArchitectureNode node : nodes) {
            String path = node.getFilePath() != null ? node.getFilePath().toLowerCase() : "";
            boolean isTest = path.contains("/test/") || path.contains("\\test\\") || path.endsWith("test.java") ||
                    path.endsWith("tests.java") || path.endsWith(".test.js") || path.endsWith(".spec.ts");

            if (isTest) {
                testFiles.add(node.getFilePath());
            } else {
                String type = node.getNodeType();
                if ("CLASS".equalsIgnoreCase(type) || "INTERFACE".equalsIgnoreCase(type)
                        || "ENTITY".equalsIgnoreCase(type)) {
                    allProductionKeys.add(node.getNodeKey());
                }
            }
        }

        for (ArchitectureEdge edge : edges) {
            ArchitectureNode src = nodeMap.get(edge.getSourceNodeKey());
            ArchitectureNode tgt = nodeMap.get(edge.getTargetNodeKey());
            if (src == null || tgt == null)
                continue;

            String srcPath = src.getFilePath() != null ? src.getFilePath().toLowerCase() : "";
            boolean srcIsTest = srcPath.contains("/test/") || srcPath.contains("\\test\\") ||
                    srcPath.endsWith("test.java") || srcPath.endsWith("tests.java");

            String tgtPath = tgt.getFilePath() != null ? tgt.getFilePath().toLowerCase() : "";
            boolean tgtIsTest = tgtPath.contains("/test/") || tgtPath.contains("\\test\\");

            if (srcIsTest && !tgtIsTest && allProductionKeys.contains(tgt.getNodeKey())) {
                testedProductionKeys.add(tgt.getNodeKey());
                if (mappings.size() < 25) {
                    mappings.add(ArchitectureIntelligenceDTO.TestMappingDTO.builder()
                            .testFileName(cleanComponentName(src.getName()))
                            .testFilePath(src.getFilePath())
                            .targetComponentName(cleanComponentName(tgt.getName()))
                            .targetComponentKey(tgt.getNodeKey())
                            .relationshipType(edge.getRelationshipType())
                            .build());
                }
            }
        }

        int untested = Math.max(0, allProductionKeys.size() - testedProductionKeys.size());

        return ArchitectureIntelligenceDTO.TestIntelligenceDTO.builder()
                .testFilesCount(testFiles.size())
                .testedComponentsCount(testedProductionKeys.size())
                .untestedComponentsCount(untested)
                .testMappings(mappings)
                .build();
    }

    private ArchitectureIntelligenceDTO.RuntimePerformanceSummaryDTO analyzeRuntimePerformance(
            List<RuntimeTrace> traces) {
        if (traces == null || traces.isEmpty()) {
            return ArchitectureIntelligenceDTO.RuntimePerformanceSummaryDTO.builder()
                    .telemetryAvailable(false)
                    .totalTraces(0)
                    .averageDurationMs(0.0)
                    .errorCount(0)
                    .slowestSpans(Collections.emptyList())
                    .build();
        }

        double totalDuration = 0;
        int errorCount = 0;
        List<ArchitectureIntelligenceDTO.SlowSpanDTO> allSpans = new ArrayList<>();

        for (RuntimeTrace t : traces) {
            totalDuration += (t.getDurationMs() != null ? t.getDurationMs() : 0);
            if (t.getStatusCode() != null && t.getStatusCode() >= 400) {
                errorCount++;
            }
            if (t.getSpans() != null) {
                for (RuntimeSpan s : t.getSpans()) {
                    if (Boolean.TRUE.equals(s.getHasError())) {
                        errorCount++;
                    }
                    allSpans.add(ArchitectureIntelligenceDTO.SlowSpanDTO.builder()
                            .traceId(t.getTraceId())
                            .componentName(s.getComponentName() != null ? s.getComponentName() : s.getComponentKey())
                            .operationName(s.getOperationName())
                            .durationMs(s.getDurationMs())
                            .hasError(s.getHasError())
                            .build());
                }
            }
        }

        allSpans.sort((a, b) -> Long.compare(
                b.getDurationMs() != null ? b.getDurationMs() : 0,
                a.getDurationMs() != null ? a.getDurationMs() : 0));

        double avgDuration = traces.size() > 0 ? (totalDuration / traces.size()) : 0.0;
        avgDuration = Math.round(avgDuration * 10.0) / 10.0;

        return ArchitectureIntelligenceDTO.RuntimePerformanceSummaryDTO.builder()
                .telemetryAvailable(true)
                .totalTraces(traces.size())
                .averageDurationMs(avgDuration)
                .errorCount(errorCount)
                .slowestSpans(allSpans.stream().limit(5).collect(Collectors.toList()))
                .build();
    }

    private ArchitectureIntelligenceDTO.SnapshotDeltaDTO compareSnapshots(
            com.impactmapper.entity.Repository repo,
            ArchitectureSnapshot currentSnapshot) {

        List<ArchitectureSnapshot> snaps = snapshotRepository.findByRepositoryIdOrderByAnalyzedAtDesc(repo.getId());
        if (snaps.size() < 2) {
            String sha = currentSnapshot.getCommitSha();
            String shortSha = sha != null ? sha.substring(0, Math.min(7, sha.length())) : "HEAD";
            return ArchitectureIntelligenceDTO.SnapshotDeltaDTO.builder()
                    .hasMultipleSnapshots(false)
                    .message("Single snapshot available for commit " + shortSha
                            + ". Analyze new commits or re-index to observe architecture deltas.")
                    .currentSnapshotId(currentSnapshot.getId())
                    .baselineSnapshotId(null)
                    .addedFilesCount(0)
                    .removedFilesCount(0)
                    .addedRelationshipsCount(0)
                    .removedRelationshipsCount(0)
                    .addedFiles(Collections.emptyList())
                    .removedFiles(Collections.emptyList())
                    .build();
        }

        ArchitectureSnapshot baseline = snaps.get(1);
        List<ArchitectureNode> currentNodes = nodeRepository.findBySnapshotId(currentSnapshot.getId());
        List<ArchitectureNode> baselineNodes = nodeRepository.findBySnapshotId(baseline.getId());

        Set<String> currentFiles = currentNodes.stream()
                .map(ArchitectureNode::getFilePath)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<String> baselineFiles = baselineNodes.stream()
                .map(ArchitectureNode::getFilePath)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<String> added = currentFiles.stream().filter(f -> !baselineFiles.contains(f)).collect(Collectors.toList());
        List<String> removed = baselineFiles.stream().filter(f -> !currentFiles.contains(f))
                .collect(Collectors.toList());

        List<ArchitectureEdge> currentEdges = edgeRepository.findBySnapshotId(currentSnapshot.getId());
        List<ArchitectureEdge> baselineEdges = edgeRepository.findBySnapshotId(baseline.getId());

        int addedRel = Math.max(0, currentEdges.size() - baselineEdges.size());
        int removedRel = Math.max(0, baselineEdges.size() - currentEdges.size());

        return ArchitectureIntelligenceDTO.SnapshotDeltaDTO.builder()
                .hasMultipleSnapshots(true)
                .message("Comparing commit " + currentSnapshot.getCommitSha() + " against baseline commit "
                        + baseline.getCommitSha())
                .currentSnapshotId(currentSnapshot.getId())
                .baselineSnapshotId(baseline.getId())
                .addedFilesCount(added.size())
                .removedFilesCount(removed.size())
                .addedRelationshipsCount(addedRel)
                .removedRelationshipsCount(removedRel)
                .addedFiles(added)
                .removedFiles(removed)
                .build();
    }
}
