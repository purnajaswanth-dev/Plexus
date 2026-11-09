package com.impactmapper.service;

import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OverviewService {

    private final RepositoryRepository repositoryRepository;
    private final RepoDependencyRepository dependencyRepository;
    private final HealthService healthService;

    public Map<String, Object> getOverviewMetrics() {
        List<Repository> allRepos = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByOwnerIdOrderByAddedAtDesc(u.getAppUserId()))
                .orElseGet(repositoryRepository::findAllByOrderByAddedAtDesc);
        Set<Long> userRepoIds = allRepos.stream().map(Repository::getId).collect(Collectors.toSet());
        List<RepoDependency> allDeps = userRepoIds.isEmpty()
                ? Collections.emptyList()
                : dependencyRepository.findByRepositoryIdIn(userRepoIds);

        // Group dependencies by repo ID for fast lookup
        Map<Long, List<RepoDependency>> depsByRepo = allDeps.stream()
                .filter(d -> d.getRepository() != null && d.getRepository().getId() != null)
                .collect(Collectors.groupingBy(d -> d.getRepository().getId()));

        int healthyCount = 0;
        int moderateCount = 0;
        int criticalCount = 0;

        List<Map<String, Object>> attentionRequiredList = new ArrayList<>();
        LocalDateTime mostRecentIndex = null;

        for (Repository repo : allRepos) {
            List<RepoDependency> deps = depsByRepo.getOrDefault(repo.getId(), Collections.emptyList());
            HealthService.HealthReport report = healthService.evaluateHealth(repo, deps);

            if ("Healthy".equals(report.getRating())) {
                healthyCount++;
            } else if ("Moderate".equals(report.getRating())) {
                moderateCount++;
                Map<String, Object> item = new HashMap<>();
                item.put("id", repo.getId());
                item.put("repoName", repo.getRepoName());
                item.put("repoUrl", repo.getRepoUrl());
                item.put("score", report.getScore());
                item.put("rating", report.getRating());
                item.put("issues", report.getIssues());
                item.put("dependencyCount", deps.size());
                item.put("lastIndexed", repo.getLastIndexed());
                attentionRequiredList.add(item);
            } else {
                criticalCount++;
                Map<String, Object> item = new HashMap<>();
                item.put("id", repo.getId());
                item.put("repoName", repo.getRepoName());
                item.put("repoUrl", repo.getRepoUrl());
                item.put("score", report.getScore());
                item.put("rating", report.getRating());
                item.put("issues", report.getIssues());
                item.put("dependencyCount", deps.size());
                item.put("lastIndexed", repo.getLastIndexed());
                attentionRequiredList.add(item);
            }

            if (repo.getLastIndexed() != null) {
                if (mostRecentIndex == null || repo.getLastIndexed().isAfter(mostRecentIndex)) {
                    mostRecentIndex = repo.getLastIndexed();
                }
            }
        }

        // Sort attention required: lowest score first
        attentionRequiredList.sort((a, b) -> Integer.compare((Integer) a.get("score"), (Integer) b.get("score")));

        // Calculate unique libraries
        Set<String> uniqueLibKeys = new HashSet<>();
        // Also compute shared count per library
        Map<String, Set<Long>> libraryRepoMap = new HashMap<>();
        Map<String, Set<String>> libraryVersionsMap = new HashMap<>();
        Map<String, String> libraryTypeMap = new HashMap<>();
        Map<String, String> libraryGroupMap = new HashMap<>();
        Map<String, String> libraryArtifactMap = new HashMap<>();

        for (RepoDependency dep : allDeps) {
            String packageType = dep.getPackageType() != null ? dep.getPackageType() : "MAVEN";
            String groupId = dep.getGroupId() != null ? dep.getGroupId() : "";
            String artifactId = dep.getArtifactId() != null ? dep.getArtifactId() : "";
            String key = packageType + "::" + groupId + "::" + artifactId;

            uniqueLibKeys.add(key);
            libraryTypeMap.put(key, packageType);
            libraryGroupMap.put(key, groupId);
            libraryArtifactMap.put(key, artifactId);

            if (dep.getRepository() != null && dep.getRepository().getId() != null) {
                libraryRepoMap.computeIfAbsent(key, k -> new HashSet<>()).add(dep.getRepository().getId());
            }

            if (dep.getVersion() != null && !dep.getVersion().isBlank()) {
                libraryVersionsMap.computeIfAbsent(key, k -> new HashSet<>()).add(dep.getVersion());
            }
        }

        // Top shared dependencies
        List<Map<String, Object>> topDependencies = libraryRepoMap.entrySet().stream()
                .sorted((e1, e2) -> Integer.compare(e2.getValue().size(), e1.getValue().size()))
                .limit(8)
                .map(e -> {
                    String key = e.getKey();
                    Map<String, Object> map = new HashMap<>();
                    map.put("key", key);
                    map.put("packageType", libraryTypeMap.get(key));
                    map.put("groupId", libraryGroupMap.get(key));
                    map.put("artifactId", libraryArtifactMap.get(key));
                    map.put("displayName", "NPM".equalsIgnoreCase(libraryTypeMap.get(key))
                            ? libraryArtifactMap.get(key)
                            : (libraryGroupMap.get(key) + ":" + libraryArtifactMap.get(key)));
                    map.put("repoCount", e.getValue().size());
                    Set<String> versions = libraryVersionsMap.getOrDefault(key, Collections.emptySet());
                    map.put("versionCount", versions.size());
                    map.put("versions", new ArrayList<>(versions));
                    return map;
                })
                .collect(Collectors.toList());

        // Recent Activity (sorted by lastIndexed desc)
        List<Map<String, Object>> recentActivity = allRepos.stream()
                .filter(r -> r.getLastIndexed() != null)
                .sorted((a, b) -> b.getLastIndexed().compareTo(a.getLastIndexed()))
                .limit(8)
                .map(r -> {
                    List<RepoDependency> deps = depsByRepo.getOrDefault(r.getId(), Collections.emptyList());
                    HealthService.HealthReport report = healthService.evaluateHealth(r, deps);
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", r.getId());
                    map.put("repoName", r.getRepoName());
                    map.put("repoUrl", r.getRepoUrl());
                    map.put("indexStatus", r.getIndexStatus());
                    map.put("dependencyFileType", r.getDependencyFileType());
                    map.put("lastIndexed", r.getLastIndexed());
                    map.put("dependencyCount", deps.size());
                    map.put("healthScore", report.getScore());
                    map.put("healthRating", report.getRating());
                    return map;
                })
                .collect(Collectors.toList());

        long indexedCount = allRepos.stream().filter(r -> "INDEXED".equalsIgnoreCase(r.getIndexStatus())).count();
        long failedCount = allRepos.stream().filter(r -> "FAILED".equalsIgnoreCase(r.getIndexStatus())).count();

        Map<String, Object> response = new HashMap<>();
        response.put("totalRepositories", allRepos.size());
        response.put("indexedRepositories", indexedCount);
        response.put("failedRepositories", failedCount);
        response.put("totalDependencies", allDeps.size());
        response.put("uniqueLibraries", uniqueLibKeys.size());
        response.put("attentionCount", attentionRequiredList.size());
        response.put("lastIndexed", mostRecentIndex);

        Map<String, Integer> healthDist = new HashMap<>();
        healthDist.put("healthy", healthyCount);
        healthDist.put("moderate", moderateCount);
        healthDist.put("critical", criticalCount);
        response.put("healthDistribution", healthDist);

        response.put("topDependencies", topDependencies);
        response.put("recentActivity", recentActivity);
        response.put("attentionRequired", attentionRequiredList);

        return response;
    }
}
