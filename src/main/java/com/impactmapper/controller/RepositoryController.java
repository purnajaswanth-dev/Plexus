package com.impactmapper.controller;

import com.impactmapper.entity.ArchitectureSnapshot;
import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.repository.ArchitectureEdgeRepository;
import com.impactmapper.repository.ArchitectureNodeRepository;
import com.impactmapper.repository.ArchitectureSnapshotRepository;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import com.impactmapper.service.HealthService;
import com.impactmapper.service.RepoIndexingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/repos")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RepositoryController {

    private final RepoIndexingService indexingService;
    private final RepositoryRepository repositoryRepository;
    private final RepoDependencyRepository dependencyRepository;
    private final ArchitectureSnapshotRepository snapshotRepository;
    private final ArchitectureNodeRepository nodeRepository;
    private final ArchitectureEdgeRepository edgeRepository;
    private final HealthService healthService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> addRepository(@RequestBody Map<String, String> request) {
        if (request == null || !request.containsKey("githubUrl")) {
            throw new IllegalArgumentException("GitHub repository URL must not be blank");
        }
        String githubUrl = request.get("githubUrl");
        if (githubUrl == null || githubUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("GitHub repository URL must not be blank");
        }

        Repository repo = indexingService.indexRepository(githubUrl.trim());
        List<RepoDependency> deps = dependencyRepository.findByRepositoryId(repo.getId());
        HealthService.HealthReport health = healthService.evaluateHealth(repo, deps);

        Map<String, Object> response = new HashMap<>();
        response.put("repository", repo);
        response.put("dependencyCount", deps.size());
        response.put("healthScore", health.getScore());
        response.put("healthRating", health.getRating());
        response.put("healthIssues", health.getIssues());

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllRepositories() {
        List<Repository> repos = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByOwnerIdOrderByAddedAtDesc(u.getAppUserId()))
                .orElseGet(repositoryRepository::findAllByOrderByAddedAtDesc);

        Set<Long> repoIds = repos.stream().map(Repository::getId).collect(Collectors.toSet());
        List<RepoDependency> allDeps = repoIds.isEmpty()
                ? Collections.emptyList()
                : dependencyRepository.findByRepositoryIdIn(repoIds);

        Map<Long, List<RepoDependency>> depsByRepo = allDeps.stream()
                .filter(d -> d.getRepository() != null && d.getRepository().getId() != null)
                .collect(Collectors.groupingBy(d -> d.getRepository().getId()));

        return repos.stream().map(repo -> {
            List<RepoDependency> deps = depsByRepo.getOrDefault(repo.getId(), Collections.emptyList());
            HealthService.HealthReport health = healthService.evaluateHealth(repo, deps);

            Map<String, Object> map = new HashMap<>();
            map.put("id", repo.getId());
            map.put("repoName", repo.getRepoName());
            map.put("repoUrl", repo.getRepoUrl());
            map.put("description", repo.getDescription());
            map.put("language", repo.getLanguage());
            map.put("defaultBranch", repo.getDefaultBranch());
            map.put("indexStatus", repo.getIndexStatus());
            map.put("statusDetail", repo.getStatusDetail());
            map.put("dependencyFileType", repo.getDependencyFileType());
            map.put("isMonorepo", repo.getIsMonorepo());
            map.put("totalFilesDiscovered", repo.getTotalFilesDiscovered());
            map.put("commitSha", repo.getCommitSha());
            map.put("lastIndexed", repo.getLastIndexed());
            map.put("addedAt", repo.getAddedAt());
            map.put("dependencyCount", deps.size());
            map.put("healthScore", health.getScore());
            map.put("healthRating", health.getRating());
            map.put("healthIssues", health.getIssues());
            return map;
        }).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getRepositoryDetail(@PathVariable Long id) {
        Optional<Repository> repoOpt = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByIdAndOwnerId(id, u.getAppUserId()))
                .orElseGet(() -> repositoryRepository.findById(id));
        if (repoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Repository repo = repoOpt.get();
        List<RepoDependency> deps = dependencyRepository.findByRepositoryId(id);
        HealthService.HealthReport health = healthService.evaluateHealth(repo, deps);

        Map<String, List<RepoDependency>> grouped = deps.stream()
                .collect(Collectors
                        .groupingBy(d -> (d.getScope() != null && !d.getScope().isBlank()) ? d.getScope() : "compile"));

        Map<String, Object> response = new HashMap<>();
        response.put("repository", repo);
        response.put("dependencyCount", deps.size());
        response.put("healthScore", health.getScore());
        response.put("healthRating", health.getRating());
        response.put("healthIssues", health.getIssues());
        response.put("dependencies", grouped);
        response.put("allDependencies", deps);

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteRepository(@PathVariable Long id) {
        boolean exists = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.existsByIdAndOwnerId(id, u.getAppUserId()))
                .orElseGet(() -> repositoryRepository.existsById(id));
        if (!exists) {
            return ResponseEntity.notFound().build();
        }
        List<ArchitectureSnapshot> snapshots = snapshotRepository.findByRepositoryIdOrderByAnalyzedAtDesc(id);
        for (ArchitectureSnapshot s : snapshots) {
            edgeRepository.deleteBySnapshotId(s.getId());
            nodeRepository.deleteBySnapshotId(s.getId());
            snapshotRepository.delete(s);
        }
        dependencyRepository.deleteByRepositoryId(id);
        repositoryRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reindex")
    public ResponseEntity<Map<String, Object>> reindexRepository(@PathVariable Long id) {
        Repository repo = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByIdAndOwnerId(id, u.getAppUserId()))
                .orElseGet(() -> repositoryRepository.findById(id))
                .orElseThrow(() -> new RepoNotFoundException("Repo not found with ID: " + id));

        Repository reindexed = indexingService.indexRepository(repo.getRepoUrl());
        List<RepoDependency> deps = dependencyRepository.findByRepositoryId(reindexed.getId());
        HealthService.HealthReport health = healthService.evaluateHealth(reindexed, deps);

        Map<String, Object> response = new HashMap<>();
        response.put("repository", reindexed);
        response.put("dependencyCount", deps.size());
        response.put("healthScore", health.getScore());
        response.put("healthRating", health.getRating());
        response.put("healthIssues", health.getIssues());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/reindex-all")
    public Map<String, Object> reindexAll() {
        int initialCount = (int) repositoryRepository.count();
        indexingService.reindexAll();
        Map<String, Object> res = new HashMap<>();
        res.put("reindexedCount", initialCount);
        res.put("status", "SUCCESS");
        return res;
    }
}
