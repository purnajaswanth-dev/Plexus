package com.impactmapper.service;

import com.impactmapper.dto.GitTreeResult;
import com.impactmapper.entity.ArchitectureEdge;
import com.impactmapper.entity.ArchitectureNode;
import com.impactmapper.entity.ArchitectureSnapshot;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.ArchitectureEdgeRepository;
import com.impactmapper.repository.ArchitectureNodeRepository;
import com.impactmapper.repository.ArchitectureSnapshotRepository;
import com.impactmapper.repository.RepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArchitectureAnalysisService {

    private final GitHubService gitHubService;
    private final JavaSourceAnalysisService javaAnalysisService;
    private final JavaScriptSourceAnalysisService jsAnalysisService;
    private final ArchitectureSnapshotRepository snapshotRepository;
    private final ArchitectureNodeRepository nodeRepository;
    private final ArchitectureEdgeRepository edgeRepository;
    private final RepositoryRepository repositoryRepository;
    private final org.springframework.beans.factory.ObjectProvider<CodeCityService> codeCityServiceProvider;
    private final org.springframework.transaction.PlatformTransactionManager transactionManager;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    private final org.springframework.beans.factory.ObjectProvider<com.impactmapper.config.IndexingResourceLimits> resourceLimitsProvider;
    private final java.util.concurrent.atomic.AtomicInteger activeAnalysisJobs = new java.util.concurrent.atomic.AtomicInteger(0);
    private final java.util.concurrent.Semaphore globalAnalysisSemaphore = new java.util.concurrent.Semaphore(1);
    private final java.util.concurrent.ConcurrentHashMap<Long, java.util.concurrent.CompletableFuture<ArchitectureSnapshot>> inFlightAnalysis = new java.util.concurrent.ConcurrentHashMap<>();

    public int getActiveAnalysisCount() {
        return activeAnalysisJobs.get();
    }

    private static final int MAX_FILES_TO_ANALYZE = 1000;

    public ArchitectureSnapshot analyzeRepositoryArchitecture(Long repoId) {
        Repository repo = repositoryRepository.findById(repoId)
                .orElseThrow(() -> new IllegalArgumentException("Repository not found with ID: " + repoId));

        return analyzeRepositoryArchitecture(repo);
    }

    public ArchitectureSnapshot analyzeRepositoryArchitecture(Repository repository) {
        String owner;
        String repoName;
        try {
            com.impactmapper.util.GitHubUrlParser.ParsedRepo parsed = com.impactmapper.util.GitHubUrlParser
                    .parse(repository.getRepoUrl());
            owner = parsed.getOwner();
            repoName = parsed.getRepo();
        } catch (Exception e) {
            Pattern pattern = Pattern.compile("github\\.com/([^/]+)/([^/]+?)(?:\\.git|/|$)");
            Matcher matcher = pattern.matcher(repository.getRepoUrl());
            if (!matcher.find()) {
                log.warn("Cannot analyze architecture: invalid GitHub URL {}", repository.getRepoUrl());
                return null;
            }
            owner = matcher.group(1);
            repoName = matcher.group(2);
        }
        String branch = repository.getDefaultBranch() != null ? repository.getDefaultBranch() : "main";

        Long repoId = repository.getId();
        if (repoId != null) {
            java.util.concurrent.CompletableFuture<ArchitectureSnapshot> inFlight = inFlightAnalysis.get(repoId);
            if (inFlight != null) {
                log.info("Deduplicating concurrent architecture analysis request for repository ID: {}", repoId);
                try {
                    return inFlight.join();
                } catch (Exception e) {
                    log.warn("In-flight architecture analysis failed for repoId {}: {}", repoId, e.getMessage());
                }
            }
        }

        boolean permitAcquired = false;
        java.util.concurrent.CompletableFuture<ArchitectureSnapshot> future = new java.util.concurrent.CompletableFuture<>();
        if (repoId != null) {
            inFlightAnalysis.put(repoId, future);
        }

        log.info("Analyzing architecture for {}/{} (branch: {})...", owner, repoName, branch);

        activeAnalysisJobs.incrementAndGet();
        try {
            permitAcquired = globalAnalysisSemaphore.tryAcquire(5, java.util.concurrent.TimeUnit.SECONDS);
            if (!permitAcquired) {
                log.warn("Architecture analysis rejected for {}: another analysis job is currently executing.", repository.getRepoName());
                throw new IllegalStateException("An architecture analysis job is currently in progress. Capacity is limited to 1 concurrent analysis job on the free tier. Please retry in a few moments.");
            }

            GitTreeResult treeResult = gitHubService.fetchFileTree(owner, repoName, branch);
            List<String> allFiles = treeResult.getFilePaths();

            if (allFiles.isEmpty()) {
                log.warn("No files found in tree for {}/{}", owner, repoName);
                future.complete(null);
                return null;
            }

            // Filter relevant source files
            List<String> sourceFiles = filterSourceFiles(allFiles, repository.getDependencyFileType());
            int maxAllowedFiles = (resourceLimitsProvider != null && resourceLimitsProvider.getIfAvailable() != null)
                    ? resourceLimitsProvider.getIfAvailable().getMaxSourceFiles()
                    : 150;
            if (sourceFiles.size() > maxAllowedFiles) {
                String errorMsg = String.format("Architecture analysis rejected: repository contains %d candidate source files (free-tier limit: %d files).",
                        sourceFiles.size(), maxAllowedFiles);
                log.warn(errorMsg);
                com.impactmapper.exception.RepositoryResourceLimitExceededException limitEx =
                        new com.impactmapper.exception.RepositoryResourceLimitExceededException(
                                "MAX_SOURCE_FILES", sourceFiles.size(), maxAllowedFiles, "files", errorMsg);
                future.completeExceptionally(limitEx);
                throw limitEx;
            }

            log.info("Found {} candidate source files for architecture analysis in {}", sourceFiles.size(),
                    repository.getRepoName());

            // Fast In-Memory Ingestion: Download repository archive in 1 request
            Map<String, String> archiveFiles = new HashMap<>();
            try {
                Map<String, String> downloaded = gitHubService.downloadRepositoryArchive(owner, repoName, branch);
                if (downloaded != null) {
                    archiveFiles.putAll(downloaded);
                }
                log.info("Archive ingestion ready for {}/{} with {} files extracted", owner, repoName, archiveFiles.size());
            } catch (com.impactmapper.exception.RepositoryResourceLimitExceededException limitEx) {
                future.completeExceptionally(limitEx);
                throw limitEx;
            } catch (Exception ex) {
                log.warn("Archive download fallback to individual file fetch for {}/{}: {}", owner, repoName,
                        ex.getMessage());
            }

            ArchitectureSnapshot snapshot = ArchitectureSnapshot.builder()
                    .repository(repository)
                    .commitSha(treeResult.getCommitSha())
                    .analyzedAt(LocalDateTime.now())
                    .primaryLanguage(repository.getLanguage())
                    .status("ANALYZED")
                    .totalFilesAnalyzed(sourceFiles.size())
                    .build();

            // Map to deduplicate nodes by key
            Map<String, ArchitectureNode> nodeMap = new LinkedHashMap<>();
            // Root Repository Node
            String repoNodeKey = "repo:" + repository.getRepoName();
            ArchitectureNode repoNode = ArchitectureNode.builder()
                    .snapshot(snapshot)
                    .nodeKey(repoNodeKey)
                    .name(repository.getRepoName())
                    .nodeType("REPOSITORY")
                    .filePath("/")
                    .packageOrModule("Root")
                    .evidenceConfidence("DIRECTLY_DETECTED")
                    .level(1)
                    .build();
            nodeMap.put(repoNodeKey, repoNode);

            List<ArchitectureEdge> edgeList = new ArrayList<>();

            for (String filePath : sourceFiles) {
                try {
                    // Evict from map immediately after retrieval to free string heap memory progressively
                    String content = archiveFiles.remove(filePath);
                    if (content == null || content.isBlank()) {
                        content = gitHubService.fetchFileContent(owner, repoName, branch, filePath);
                    }
                    if (content == null || content.isBlank())
                        continue;

                    JavaSourceAnalysisService.AnalysisResult fileResult;
                    if (filePath.endsWith(".java")) {
                        fileResult = javaAnalysisService.analyzeJavaFile(filePath, content, snapshot);
                        if (fileResult.nodes.isEmpty()) {
                            fileResult = createBasicFileResult(filePath, content, snapshot);
                        }
                    } else if (filePath.endsWith(".js") || filePath.endsWith(".ts") || filePath.endsWith(".jsx")
                            || filePath.endsWith(".tsx")) {
                        fileResult = jsAnalysisService.analyzeJsFile(filePath, content, snapshot);
                        if (fileResult.nodes.isEmpty()) {
                            fileResult = createBasicFileResult(filePath, content, snapshot);
                        }
                    } else {
                        fileResult = createBasicFileResult(filePath, content, snapshot);
                    }

                    for (ArchitectureNode n : fileResult.nodes) {
                        nodeMap.putIfAbsent(n.getNodeKey(), n);
                    }
                    edgeList.addAll(fileResult.edges);

                    // Connect level 1 nodes to root repository
                    for (ArchitectureNode n : fileResult.nodes) {
                        if (n.getLevel() != null && n.getLevel() == 1) {
                            edgeList.add(ArchitectureEdge.builder()
                                    .snapshot(snapshot)
                                    .sourceNodeKey(repoNodeKey)
                                    .targetNodeKey(n.getNodeKey())
                                    .relationshipType("CONTAINS")
                                    .evidence("Repository structural layout")
                                    .evidenceLevel("DIRECTLY_DETECTED")
                                    .build());
                        }
                    }

                } catch (Exception e) {
                    log.warn("Error analyzing source file {}: {}", filePath, e.getMessage());
                }
            }

            // Immediately purge any unconsumed archive entries before DB batching & city layout calculation
            archiveFiles.clear();

            // Deduplicate edges
            Set<String> seenEdges = new HashSet<>();
            List<ArchitectureEdge> cleanEdges = new ArrayList<>();
            for (ArchitectureEdge edge : edgeList) {
                String edgeKey = edge.getSourceNodeKey() + "->" + edge.getTargetNodeKey() + ":"
                        + edge.getRelationshipType();
                if (seenEdges.add(edgeKey)) {
                    cleanEdges.add(edge);
                }
            }

            // Atomic Compact Persistence: Only hold DB connection during instant batch saves
            final List<String> finalSourceFiles = sourceFiles;
            org.springframework.transaction.support.TransactionTemplate tx = new org.springframework.transaction.support.TransactionTemplate(
                    transactionManager);
            ArchitectureSnapshot savedSnapshot = tx.execute(status -> {
                ArchitectureSnapshot snap = snapshotRepository.save(snapshot);
                List<ArchitectureNode> nodesToInsert = new ArrayList<>(nodeMap.values());

                String nodeSql = "INSERT INTO architecture_nodes (snapshot_id, node_key, name, node_type, file_path, package_or_module, annotations_json, start_line, end_line, evidence_confidence, level) "
                        +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                jdbcTemplate.batchUpdate(nodeSql, nodesToInsert, 100, (ps, n) -> {
                    ps.setLong(1, snap.getId());
                    ps.setString(2, n.getNodeKey());
                    ps.setString(3, n.getName());
                    ps.setString(4, n.getNodeType());
                    ps.setString(5, n.getFilePath());
                    ps.setString(6, n.getPackageOrModule());
                    ps.setString(7, n.getAnnotationsJson());
                    if (n.getStartLine() != null)
                        ps.setInt(8, n.getStartLine());
                    else
                        ps.setNull(8, java.sql.Types.INTEGER);
                    if (n.getEndLine() != null)
                        ps.setInt(9, n.getEndLine());
                    else
                        ps.setNull(9, java.sql.Types.INTEGER);
                    ps.setString(10, n.getEvidenceConfidence());
                    if (n.getLevel() != null)
                        ps.setInt(11, n.getLevel());
                    else
                        ps.setNull(11, java.sql.Types.INTEGER);
                });

                String edgeSql = "INSERT INTO architecture_edges (snapshot_id, source_node_key, target_node_key, relationship_type, evidence, evidence_level) "
                        +
                        "VALUES (?, ?, ?, ?, ?, ?)";
                jdbcTemplate.batchUpdate(edgeSql, cleanEdges, 100, (ps, e) -> {
                    ps.setLong(1, snap.getId());
                    ps.setString(2, e.getSourceNodeKey());
                    ps.setString(3, e.getTargetNodeKey());
                    ps.setString(4, e.getRelationshipType());
                    ps.setString(5, e.getEvidence());
                    ps.setString(6, e.getEvidenceLevel());
                });

                snap.setTotalComponents(nodesToInsert.size());
                snap.setTotalRelationships(cleanEdges.size());
                snap.setAnalysisSummary(String.format(
                        "Indexed %d source files, detected %d architecture components and %d verified relationships.",
                        finalSourceFiles.size(), nodesToInsert.size(), cleanEdges.size()));

                ArchitectureSnapshot flushedSnap = snapshotRepository.save(snap);
                log.info("Architecture analysis complete for {}: {} nodes, {} edges.", repository.getRepoName(),
                        nodesToInsert.size(), cleanEdges.size());
                return flushedSnap;
            });

            if (savedSnapshot != null) {
                try {
                    codeCityServiceProvider.ifAvailable(service -> service.syncCityModel(repository, savedSnapshot));
                } catch (Exception e) {
                    log.warn("CodeCity model generation skipped for {}: {}", repository.getRepoName(), e.getMessage());
                }
            }

            future.complete(savedSnapshot);
            return savedSnapshot;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            future.completeExceptionally(e);
            throw new IllegalStateException("Architecture analysis interrupted while waiting for capacity", e);
        } catch (RuntimeException e) {
            future.completeExceptionally(e);
            throw e;
        } catch (Exception e) {
            future.completeExceptionally(e);
            throw new RuntimeException("Architecture analysis failed: " + e.getMessage(), e);
        } finally {
            if (repoId != null) {
                inFlightAnalysis.remove(repoId);
            }
            if (permitAcquired) {
                globalAnalysisSemaphore.release();
            }
            activeAnalysisJobs.decrementAndGet();
        }
    }

    private static String truncate(String s, int maxLen) {
        if (s == null)
            return null;
        return s.length() <= maxLen ? s : s.substring(0, maxLen);
    }

    private List<String> filterSourceFiles(List<String> files, String ecosystem) {
        return files.stream()
                .filter(f -> !f.contains("/target/") && !f.startsWith("target/")
                        && !f.contains("/node_modules/") && !f.startsWith("node_modules/")
                        && !f.contains("/.git/") && !f.startsWith(".git/")
                        && !f.contains("/dist/") && !f.startsWith("dist/")
                        && !f.contains("/build/") && !f.startsWith("build/")
                        && !f.contains("/.mvn/") && !f.startsWith(".mvn/")
                        && !f.contains("/vendor/") && !f.startsWith("vendor/")
                        && !f.contains("/test/") && !f.contains("/tests/"))
                .filter(f -> {
                    String lower = f.toLowerCase();
                    boolean isCode = lower.endsWith(".java") || lower.endsWith(".js") || lower.endsWith(".ts")
                            || lower.endsWith(".jsx") || lower.endsWith(".tsx");
                    boolean isConfig = lower.endsWith(".yml") || lower.endsWith(".yaml") || lower.endsWith(".json")
                            || lower.endsWith(".properties") || lower.endsWith(".xml") || lower.endsWith(".sql");
                    return isCode || isConfig;
                })
                .sorted((a, b) -> {
                    // Prioritize controllers, services, repositories, entities, app files
                    int scoreA = fileImportanceScore(a);
                    int scoreB = fileImportanceScore(b);
                    return Integer.compare(scoreB, scoreA);
                })
                .collect(Collectors.toList());
    }

    private JavaSourceAnalysisService.AnalysisResult createBasicFileResult(String filePath, String content,
            ArchitectureSnapshot snapshot) {
        JavaSourceAnalysisService.AnalysisResult result = new JavaSourceAnalysisService.AnalysisResult();
        int lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        String fileName = lastSlash != -1 ? filePath.substring(lastSlash + 1) : filePath;
        String folder = lastSlash != -1 ? filePath.substring(0, lastSlash) : "root";
        String pkg = folder.replace('/', '.');
        int lineCount = (content != null && !content.isEmpty()) ? content.split("\r\n|\r|\n").length : 1;

        String nodeType = "CONFIG_FILE";
        if (filePath.endsWith(".json"))
            nodeType = "DATA_FILE";
        else if (filePath.endsWith(".xml") || filePath.endsWith(".yml") || filePath.endsWith(".yaml")
                || filePath.endsWith(".properties"))
            nodeType = "CONFIG";
        else if (filePath.endsWith(".css") || filePath.endsWith(".html"))
            nodeType = "UI_RESOURCE";
        else if (filePath.endsWith(".sql"))
            nodeType = "DATABASE";

        ArchitectureNode node = ArchitectureNode.builder()
                .snapshot(snapshot)
                .nodeKey("file:" + filePath)
                .name(fileName)
                .nodeType(nodeType)
                .filePath(filePath)
                .packageOrModule(pkg)
                .level(2)
                .startLine(1)
                .endLine(lineCount)
                .evidenceConfidence("DIRECTLY_DETECTED")
                .build();
        result.nodes.add(node);
        return result;
    }

    private int fileImportanceScore(String path) {
        String lower = path.toLowerCase();
        int score = 0;
        if (lower.contains("controller"))
            score += 50;
        if (lower.contains("service"))
            score += 40;
        if (lower.contains("repository") || lower.contains("dao"))
            score += 35;
        if (lower.contains("entity") || lower.contains("model"))
            score += 30;
        if (lower.contains("config"))
            score += 20;
        if (lower.contains("app") || lower.contains("main"))
            score += 25;
        if (lower.contains("route") || lower.contains("api"))
            score += 45;
        return score;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getArchitectureGraph(Long repoId, Integer maxLevel) {
        ArchitectureSnapshot snapshot = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repoId)
                .orElse(null);

        Map<String, Object> response = new HashMap<>();
        if (snapshot == null) {
            response.put("status", "NOT_ANALYZED");
            response.put("nodes", Collections.emptyList());
            response.put("edges", Collections.emptyList());
            return response;
        }

        List<ArchitectureNode> nodes;
        if (maxLevel != null && maxLevel > 0) {
            nodes = nodeRepository.findBySnapshotIdAndLevelLessThanEqual(snapshot.getId(), maxLevel);
        } else {
            nodes = nodeRepository.findBySnapshotId(snapshot.getId());
        }

        Set<String> visibleKeys = nodes.stream().map(ArchitectureNode::getNodeKey).collect(Collectors.toSet());
        List<ArchitectureEdge> allEdges = edgeRepository.findBySnapshotId(snapshot.getId());

        List<ArchitectureEdge> visibleEdges = allEdges.stream()
                .filter(e -> visibleKeys.contains(e.getSourceNodeKey()) && visibleKeys.contains(e.getTargetNodeKey()))
                .collect(Collectors.toList());

        List<Map<String, Object>> serializedEdges = visibleEdges.stream()
                .map(e -> {
                    Map<String, Object> edgeMap = new HashMap<>();
                    edgeMap.put("id", e.getId());
                    edgeMap.put("source", e.getSourceNodeKey());
                    edgeMap.put("target", e.getTargetNodeKey());
                    edgeMap.put("sourceNodeKey", e.getSourceNodeKey());
                    edgeMap.put("targetNodeKey", e.getTargetNodeKey());
                    edgeMap.put("relationshipType", e.getRelationshipType());
                    edgeMap.put("evidence", e.getEvidence());
                    edgeMap.put("evidenceLevel", e.getEvidenceLevel());
                    return edgeMap;
                })
                .collect(Collectors.toList());

        response.put("snapshotId", snapshot.getId());
        response.put("status", snapshot.getStatus());
        response.put("commitSha", snapshot.getCommitSha());
        response.put("analyzedAt", snapshot.getAnalyzedAt());
        response.put("totalFilesAnalyzed", snapshot.getTotalFilesAnalyzed());
        response.put("summary", snapshot.getAnalysisSummary());
        response.put("nodes", nodes);
        response.put("edges", serializedEdges);
        response.put("totalNodes", nodes.size());
        response.put("totalEdges", serializedEdges.size());
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getArchitectureStatus() {
        List<Repository> repositories = repositoryRepository.findAll();
        List<Map<String, Object>> repoSummaries = new ArrayList<>();
        int analyzedCount = 0;
        int missingCount = 0;
        List<Long> missingRepoIds = new ArrayList<>();

        for (Repository repo : repositories) {
            Optional<ArchitectureSnapshot> snapOpt = snapshotRepository
                    .findTopByRepositoryIdOrderByAnalyzedAtDesc(repo.getId());
            Map<String, Object> summary = new HashMap<>();
            summary.put("repoId", repo.getId());
            summary.put("repoName", repo.getRepoName());
            summary.put("ecosystem", repo.getDependencyFileType());
            summary.put("indexStatus", repo.getIndexStatus());

            if (snapOpt.isPresent() && "ANALYZED".equalsIgnoreCase(snapOpt.get().getStatus())) {
                analyzedCount++;
                ArchitectureSnapshot snap = snapOpt.get();
                summary.put("hasSnapshot", true);
                summary.put("status", snap.getStatus());
                summary.put("analyzedAt", snap.getAnalyzedAt());
                summary.put("commitSha", snap.getCommitSha());
                summary.put("components", snap.getTotalComponents());
                summary.put("relationships", snap.getTotalRelationships());
            } else {
                missingCount++;
                missingRepoIds.add(repo.getId());
                summary.put("hasSnapshot", false);
                summary.put("status", "NOT_ANALYZED");
            }
            repoSummaries.add(summary);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalRepositories", repositories.size());
        result.put("analyzedCount", analyzedCount);
        result.put("missingCount", missingCount);
        result.put("missingRepoIds", missingRepoIds);
        result.put("repositories", repoSummaries);
        return result;
    }

    public Map<String, Object> backfillArchitecture(List<Long> targetRepoIds) {
        List<Repository> repositories;
        if (targetRepoIds != null && !targetRepoIds.isEmpty()) {
            repositories = repositoryRepository.findAllById(targetRepoIds);
        } else {
            repositories = repositoryRepository.findAll();
        }

        List<Map<String, Object>> results = new ArrayList<>();
        int successCount = 0;
        int failedCount = 0;
        int skippedCount = 0;

        for (Repository repo : repositories) {
            Map<String, Object> itemResult = new HashMap<>();
            itemResult.put("repoId", repo.getId());
            itemResult.put("repoName", repo.getRepoName());

            // Skip failed repos or repos without manifest
            if ("FAILED".equalsIgnoreCase(repo.getIndexStatus())
                    || "NONE".equalsIgnoreCase(repo.getDependencyFileType())) {
                skippedCount++;
                itemResult.put("status", "SKIPPED");
                itemResult.put("message", "Repository manifest indexing status is " + repo.getIndexStatus()
                        + "; skipping static analysis.");
                results.add(itemResult);
                continue;
            }

            try {
                // Check if already analyzed recently
                Optional<ArchitectureSnapshot> existing = snapshotRepository
                        .findTopByRepositoryIdOrderByAnalyzedAtDesc(repo.getId());
                if (existing.isPresent() && "ANALYZED".equalsIgnoreCase(existing.get().getStatus())
                        && existing.get().getTotalComponents() != null && existing.get().getTotalComponents() > 0) {
                    skippedCount++;
                    itemResult.put("status", "SKIPPED");
                    itemResult.put("message",
                            "Already analyzed (" + existing.get().getTotalComponents() + " components).");
                    results.add(itemResult);
                    continue;
                }

                ArchitectureSnapshot snapshot = analyzeRepositoryArchitecture(repo);
                if (snapshot != null && "ANALYZED".equalsIgnoreCase(snapshot.getStatus())) {
                    successCount++;
                    itemResult.put("status", "SUCCESS");
                    itemResult.put("components", snapshot.getTotalComponents());
                    itemResult.put("relationships", snapshot.getTotalRelationships());
                    itemResult.put("commitSha", snapshot.getCommitSha());
                } else {
                    failedCount++;
                    itemResult.put("status", "FAILED");
                    itemResult.put("message", "Analysis completed without snapshot data.");
                }
            } catch (Exception e) {
                log.error("Failed to backfill architecture for {}: {}", repo.getRepoName(), e.getMessage());
                failedCount++;
                itemResult.put("status", "FAILED");
                itemResult.put("message", e.getMessage());
            }
            results.add(itemResult);
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalProcessed", repositories.size());
        summary.put("successCount", successCount);
        summary.put("failedCount", failedCount);
        summary.put("skippedCount", skippedCount);
        summary.put("results", results);
        return summary;
    }
}
