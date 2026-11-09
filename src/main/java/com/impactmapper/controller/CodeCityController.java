package com.impactmapper.controller;

import com.impactmapper.dto.codecity.*;
import com.impactmapper.entity.ArchitectureSnapshot;
import com.impactmapper.entity.Repository;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.repository.ArchitectureSnapshotRepository;
import com.impactmapper.repository.RepositoryRepository;
import com.impactmapper.service.ArchitectureAnalysisService;
import com.impactmapper.service.CodeCityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/codecity")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class CodeCityController {

    private final CodeCityService codeCityService;
    private final RepositoryRepository repositoryRepository;
    private final ArchitectureSnapshotRepository snapshotRepository;
    private final ArchitectureAnalysisService architectureAnalysisService;

    /**
     * Lists all repositories with their CodeCity generation status and metrics.
     */
    @GetMapping("/repositories")
    public ResponseEntity<List<Map<String, Object>>> getRepositoryCities() {
        List<Repository> repos = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByOwnerIdOrderByAddedAtDesc(u.getAppUserId()))
                .orElseGet(repositoryRepository::findAllByOrderByAddedAtDesc);
        List<Map<String, Object>> summaries = new ArrayList<>();

        for (Repository repo : repos) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", repo.getId());
            map.put("repoName", repo.getRepoName());
            map.put("repoUrl", repo.getRepoUrl());
            map.put("language", repo.getLanguage());
            map.put("defaultBranch", repo.getDefaultBranch());
            map.put("indexStatus", repo.getIndexStatus());
            map.put("dependencyFileType", repo.getDependencyFileType());
            map.put("isMonorepo", repo.getIsMonorepo());
            map.put("commitSha", repo.getCommitSha());

            Optional<ArchitectureSnapshot> snapOpt = snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(repo.getId());
            if (snapOpt.isPresent() && "ANALYZED".equalsIgnoreCase(snapOpt.get().getStatus())) {
                ArchitectureSnapshot snap = snapOpt.get();
                map.put("hasCity", true);
                map.put("snapshotId", snap.getId());
                map.put("analyzedAt", snap.getAnalyzedAt());
                map.put("componentsCount", snap.getTotalComponents());
                map.put("relationshipsCount", snap.getTotalRelationships());
            } else {
                map.put("hasCity", false);
            }

            summaries.add(map);
        }

        return ResponseEntity.ok(summaries);
    }

    private void validateRepoOwnership(Long repositoryId) {
        if (repositoryId == null) return;
        com.impactmapper.security.SecurityUtils.getCurrentUser().ifPresent(user -> {
            if (!repositoryRepository.existsByIdAndOwnerId(repositoryId, user.getAppUserId())) {
                throw new RepoNotFoundException("Repository not found with ID: " + repositoryId);
            }
        });
    }

    /**
     * Returns the full 2D software city model for a specific repository.
     */
    @GetMapping("/repositories/{repositoryId}/city")
    public ResponseEntity<CityModelDTO> getCityModel(@PathVariable Long repositoryId) {
        validateRepoOwnership(repositoryId);
        CityModelDTO city = codeCityService.getCityModel(repositoryId);
        return ResponseEntity.ok(city);
    }

    /**
     * Returns the discovered API endpoint catalogue for a repository.
     */
    @GetMapping("/repositories/{repositoryId}/endpoints")
    public ResponseEntity<List<EndpointDTO>> getEndpoints(@PathVariable Long repositoryId) {
        validateRepoOwnership(repositoryId);
        List<EndpointDTO> endpoints = codeCityService.getEndpoints(repositoryId);
        return ResponseEntity.ok(endpoints);
    }

    /**
     * Searchable and filterable API inventory for a repository.
     */
    @GetMapping("/repositories/{repositoryId}/apis")
    public ResponseEntity<List<EndpointDTO>> getApis(
            @PathVariable Long repositoryId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String method,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String auth,
            @RequestParam(required = false) String status) {
        validateRepoOwnership(repositoryId);
        List<EndpointDTO> apis = codeCityService.getApis(repositoryId, search, method, category, auth, status);
        return ResponseEntity.ok(apis);
    }

    /**
     * Single API endpoint detail with parameter specifications and return types.
     */
    @GetMapping("/repositories/{repositoryId}/apis/{endpointId}")
    public ResponseEntity<EndpointDTO> getApiDetail(
            @PathVariable Long repositoryId,
            @PathVariable Long endpointId) {
        validateRepoOwnership(repositoryId);
        EndpointDTO api = codeCityService.getApiDetail(repositoryId, endpointId);
        return ResponseEntity.ok(api);
    }

    /**
     * Dedicated Journey Graph for an endpoint (alias for /endpoints/{id}/journey).
     */
    @GetMapping("/repositories/{repositoryId}/apis/{endpointId}/journey")
    public ResponseEntity<JourneyGraphDTO> getApiJourneyGraph(
            @PathVariable Long repositoryId,
            @PathVariable Long endpointId,
            @RequestParam(required = false, defaultValue = "STATIC") String mode) {
        validateRepoOwnership(repositoryId);
        JourneyGraphDTO journey = codeCityService.getJourneyGraph(repositoryId, endpointId, mode);
        return ResponseEntity.ok(journey);
    }

    /**
     * API completeness and coverage metrics for a repository.
     */
    @GetMapping("/repositories/{repositoryId}/apis/coverage")
    public ResponseEntity<ApiCoverageDTO> getApiCoverage(@PathVariable Long repositoryId) {
        validateRepoOwnership(repositoryId);
        ApiCoverageDTO coverage = codeCityService.getApiCoverage(repositoryId);
        return ResponseEntity.ok(coverage);
    }

    /**
     * Bidirectional navigation: Find all APIs reaching a specific method or class.
     */
    @GetMapping("/repositories/{repositoryId}/methods/{methodKey}/apis")
    public ResponseEntity<List<EndpointDTO>> getApisReachingMethod(
            @PathVariable Long repositoryId,
            @PathVariable String methodKey) {
        validateRepoOwnership(repositoryId);
        List<EndpointDTO> apis = codeCityService.getApisReachingMethod(repositoryId, methodKey);
        return ResponseEntity.ok(apis);
    }

    /**
     * Frontend API usage matching: React client calls mapped to backend endpoints.
     */
    @GetMapping("/repositories/{repositoryId}/frontend-apis")
    public ResponseEntity<List<FrontendApiUsageDTO>> getFrontendApiUsage(@PathVariable Long repositoryId) {
        validateRepoOwnership(repositoryId);
        List<FrontendApiUsageDTO> usages = codeCityService.getFrontendApiUsage(repositoryId);
        return ResponseEntity.ok(usages);
    }

    /**
     * Returns the static inferred execution route for a specific endpoint.
     */
    @GetMapping("/repositories/{repositoryId}/endpoints/{endpointId}/path")
    public ResponseEntity<ExecutionPathDTO> getExecutionPath(@PathVariable Long repositoryId,
                                                             @PathVariable Long endpointId) {
        validateRepoOwnership(repositoryId);
        ExecutionPathDTO path = codeCityService.getStaticExecutionPath(endpointId);
        return ResponseEntity.ok(path);
    }

    /**
     * Returns the dedicated Journey Graph for an endpoint.
     */
    @GetMapping("/repositories/{repositoryId}/endpoints/{endpointId}/journey")
    public ResponseEntity<JourneyGraphDTO> getJourneyGraph(
            @PathVariable Long repositoryId,
            @PathVariable Long endpointId,
            @RequestParam(required = false, defaultValue = "STATIC") String mode) {
        validateRepoOwnership(repositoryId);
        JourneyGraphDTO journey = codeCityService.getJourneyGraph(repositoryId, endpointId, mode);
        return ResponseEntity.ok(journey);
    }

    /**
     * Returns detailed component inspector data for a building.
     */
    @GetMapping("/repositories/{repositoryId}/components")
    public ResponseEntity<ComponentDetailDTO> getComponentDetail(@PathVariable Long repositoryId,
                                                                 @RequestParam String nodeKey) {
        validateRepoOwnership(repositoryId);
        ComponentDetailDTO detail = codeCityService.getComponentDetail(repositoryId, nodeKey);
        return ResponseEntity.ok(detail);
    }

    /**
     * Returns source code snippet with highlighted lines for a file and range.
     */
    @GetMapping("/repositories/{repositoryId}/source")
    public ResponseEntity<java.util.Map<String, Object>> getSourceSnippet(
            @PathVariable Long repositoryId,
            @RequestParam String filePath,
            @RequestParam(required = false) Integer startLine,
            @RequestParam(required = false) Integer endLine) {
        validateRepoOwnership(repositoryId);
        if (filePath == null || filePath.isBlank() || filePath.contains("..") || filePath.startsWith("/") || filePath.startsWith("\\") || filePath.contains(":")) {
            return ResponseEntity.badRequest().body(Map.of("available", false, "reason", "Security validation error: Invalid file path traversal sequence"));
        }
        java.util.Map<String, Object> snippet = codeCityService.getSourceSnippet(repositoryId, filePath, startLine, endLine);
        return ResponseEntity.ok(snippet);
    }

    /**
     * Returns Architecture Intelligence for a repository.
     */
    @GetMapping("/repositories/{repositoryId}/intelligence")
    public ResponseEntity<ArchitectureIntelligenceDTO> getArchitectureIntelligence(@PathVariable Long repositoryId) {
        validateRepoOwnership(repositoryId);
        ArchitectureIntelligenceDTO intelligence = codeCityService.getArchitectureIntelligence(repositoryId);
        return ResponseEntity.ok(intelligence);
    }

    /**
     * Returns recorded runtime traces for this repository.
     */
    @GetMapping("/repositories/{repositoryId}/traces")
    public ResponseEntity<List<RuntimeTraceDTO>> getTraces(@PathVariable Long repositoryId) {
        validateRepoOwnership(repositoryId);
        List<RuntimeTraceDTO> traces = codeCityService.getTraces(repositoryId);
        return ResponseEntity.ok(traces);
    }

    /**
     * Returns trace details with spans.
     */
    @GetMapping("/repositories/{repositoryId}/traces/{traceId}")
    public ResponseEntity<RuntimeTraceDTO> getTraceDetail(@PathVariable Long repositoryId,
                                                          @PathVariable String traceId) {
        validateRepoOwnership(repositoryId);
        RuntimeTraceDTO trace = codeCityService.getTraceDetail(repositoryId, traceId);
        return ResponseEntity.ok(trace);
    }

    /**
     * Ingestion endpoint for OpenTelemetry / Java agent runtime traces.
     */
    @PostMapping("/traces/ingest")
    public ResponseEntity<RuntimeTraceDTO> ingestTrace(@RequestBody TraceIngestDTO dto) {
        if (dto == null || dto.getRepositoryId() == null) {
            return ResponseEntity.badRequest().build();
        }
        validateRepoOwnership(dto.getRepositoryId());
        if (dto.getSpans() != null && dto.getSpans().size() > 500) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(null);
        }
        RuntimeTraceDTO created = codeCityService.ingestTrace(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Triggers generation/regeneration of the CodeCity for a repository.
     */
    @PostMapping("/repositories/{repositoryId}/generate")
    public ResponseEntity<CityModelDTO> generateCity(@PathVariable Long repositoryId) {
        validateRepoOwnership(repositoryId);
        Repository repo = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new RepoNotFoundException("Repository not found with ID: " + repositoryId));

        ArchitectureSnapshot snapshot = architectureAnalysisService.analyzeRepositoryArchitecture(repo);
        if (snapshot == null) {
            throw new IllegalStateException("Failed to analyze architecture for repository: " + repo.getRepoName());
        }

        CityModelDTO city = codeCityService.syncCityModel(repo, snapshot);
        return ResponseEntity.ok(city);
    }
}

