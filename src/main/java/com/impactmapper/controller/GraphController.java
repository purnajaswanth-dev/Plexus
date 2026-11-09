package com.impactmapper.controller;

import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import com.impactmapper.service.HealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/graph")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Transactional(readOnly = true)
public class GraphController {

    private final RepositoryRepository repositoryRepository;
    private final RepoDependencyRepository dependencyRepository;
    private final HealthService healthService;

    @GetMapping
    public Map<String, Object> getRepositoryGraph() {
        return getRepositorySimilarityData();
    }

    @GetMapping("/repositories")
    public Map<String, Object> getRepositoriesView() {
        return getRepositorySimilarityData();
    }

    @GetMapping("/dependencies")
    public Map<String, Object> getBipartiteGraph() {
        return getBipartiteEcosystemData();
    }

    @GetMapping("/bipartite")
    public Map<String, Object> getBipartiteAlias() {
        return getBipartiteEcosystemData();
    }

    private Map<String, Object> getRepositorySimilarityData() {
        List<Repository> repositories = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByOwnerIdOrderByAddedAtDesc(u.getAppUserId()))
                .orElseGet(repositoryRepository::findAll);
        Set<Long> userRepoIds = repositories.stream().map(Repository::getId).collect(Collectors.toSet());
        List<RepoDependency> allDeps = userRepoIds.isEmpty()
                ? Collections.emptyList()
                : dependencyRepository.findByRepositoryIdIn(userRepoIds);
        if (allDeps.isEmpty()) {
            allDeps = dependencyRepository.findAll();
        }

        Map<Long, List<RepoDependency>> depsByRepo = allDeps.stream()
                .filter(d -> d.getRepository() != null && d.getRepository().getId() != null)
                .collect(Collectors.groupingBy(d -> d.getRepository().getId()));

        List<Map<String, Object>> nodes = new ArrayList<>();
        Map<Long, Map<String, String>> repoDepsKeyMap = new HashMap<>();

        for (Repository repo : repositories) {
            List<RepoDependency> deps = depsByRepo.getOrDefault(repo.getId(), Collections.emptyList());
            HealthService.HealthReport health = healthService.evaluateHealth(repo, deps);

            Map<String, Object> node = new HashMap<>();
            node.put("id", repo.getId());
            node.put("rawId", repo.getId());
            node.put("label", repo.getRepoName());
            String eco = "MAVEN";
            if (repo.getDependencyFileType() != null && (repo.getDependencyFileType().toUpperCase().contains("JSON") || repo.getDependencyFileType().toUpperCase().contains("NPM"))) {
                eco = "NPM";
            }
            node.put("group", eco);
            node.put("fileType", repo.getDependencyFileType() != null ? repo.getDependencyFileType() : "POM_XML");
            node.put("language", repo.getLanguage() != null ? repo.getLanguage() : "Unknown");
            node.put("repoUrl", repo.getRepoUrl());
            node.put("dependencyCount", deps.size());
            node.put("healthScore", health.getScore());
            node.put("healthRating", health.getRating());
            node.put("nodeType", "REPOSITORY");
            nodes.add(node);

            Map<String, String> depKeys = new HashMap<>();
            for (RepoDependency d : deps) {
                String key = (d.getGroupId() != null ? d.getGroupId() : "") + ":" + (d.getArtifactId() != null ? d.getArtifactId() : "");
                depKeys.put(key, d.getArtifactId());
            }
            repoDepsKeyMap.put(repo.getId(), depKeys);
        }

        List<Map<String, Object>> edges = new ArrayList<>();
        int maxWeight = 0;

        for (int i = 0; i < repositories.size(); i++) {
            for (int j = i + 1; j < repositories.size(); j++) {
                Repository r1 = repositories.get(i);
                Repository r2 = repositories.get(j);

                Map<String, String> deps1 = repoDepsKeyMap.getOrDefault(r1.getId(), Collections.emptyMap());
                Map<String, String> deps2 = repoDepsKeyMap.getOrDefault(r2.getId(), Collections.emptyMap());

                Set<String> sharedKeys = new HashSet<>(deps1.keySet());
                sharedKeys.retainAll(deps2.keySet());

                if (!sharedKeys.isEmpty()) {
                    List<String> sharedNames = sharedKeys.stream()
                            .map(k -> deps1.getOrDefault(k, k))
                            .sorted()
                            .collect(Collectors.toList());

                    int weight = sharedKeys.size();
                    if (weight > maxWeight) maxWeight = weight;

                    String first = sharedNames.get(0);
                    String label = sharedNames.size() > 1
                            ? (first + " + " + (sharedNames.size() - 1) + " more")
                            : first;

                    Set<String> unionKeys = new HashSet<>(deps1.keySet());
                    unionKeys.addAll(deps2.keySet());
                    double jaccardRatio = unionKeys.isEmpty() ? 0.0 : (double) sharedKeys.size() / unionKeys.size();
                    int similarityPct = (int) Math.round(jaccardRatio * 100.0);

                    Map<String, Object> edge = new HashMap<>();
                    edge.put("id", r1.getId() + "-" + r2.getId());
                    edge.put("source", r1.getId());
                    edge.put("target", r2.getId());
                    edge.put("sourceName", r1.getRepoName());
                    edge.put("targetName", r2.getRepoName());
                    edge.put("label", label);
                    edge.put("weight", weight);
                    edge.put("sharedDependencies", sharedNames);
                    edge.put("similarityPercentage", similarityPct);
                    edge.put("totalUnionDependencies", unionKeys.size());
                    edges.add(edge);
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("mode", "REPOSITORY_SIMILARITY");
        response.put("nodes", nodes);
        response.put("edges", edges);
        response.put("totalNodes", nodes.size());
        response.put("totalEdges", edges.size());
        response.put("maxWeight", maxWeight);
        return response;
    }

    private Map<String, Object> getBipartiteEcosystemData() {
        List<Repository> repositories = com.impactmapper.security.SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByOwnerIdOrderByAddedAtDesc(u.getAppUserId()))
                .orElseGet(repositoryRepository::findAll);
        Set<Long> userRepoIds = repositories.stream().map(Repository::getId).collect(Collectors.toSet());
        List<RepoDependency> allDeps = userRepoIds.isEmpty()
                ? Collections.emptyList()
                : dependencyRepository.findByRepositoryIdIn(userRepoIds);
        if (allDeps.isEmpty()) {
            allDeps = dependencyRepository.findAll();
        }

        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        // Repository Nodes
        for (Repository repo : repositories) {
            Map<String, Object> node = new HashMap<>();
            node.put("id", "repo-" + repo.getId());
            node.put("rawId", repo.getId());
            node.put("label", repo.getRepoName());
            node.put("nodeCategory", "REPOSITORY");
            String eco = "MAVEN";
            if (repo.getDependencyFileType() != null && (repo.getDependencyFileType().toUpperCase().contains("JSON") || repo.getDependencyFileType().toUpperCase().contains("NPM"))) {
                eco = "NPM";
            }
            node.put("ecosystem", eco);
            node.put("fileType", repo.getDependencyFileType() != null ? repo.getDependencyFileType() : "POM_XML");
            node.put("language", repo.getLanguage() != null ? repo.getLanguage() : "Unknown");
            node.put("repoUrl", repo.getRepoUrl());
            nodes.add(node);
        }

        // Aggregate Dependencies across repositories
        Map<String, List<RepoDependency>> groupedDeps = allDeps.stream().collect(
                Collectors.groupingBy(d -> {
                    String pType = d.getPackageType() != null ? d.getPackageType() : "MAVEN";
                    String gId = d.getGroupId() != null ? d.getGroupId() : "";
                    String aId = d.getArtifactId() != null ? d.getArtifactId() : "";
                    return pType + "::" + gId + "::" + aId;
                })
        );

        for (Map.Entry<String, List<RepoDependency>> entry : groupedDeps.entrySet()) {
            List<RepoDependency> deps = entry.getValue();
            if (deps.isEmpty()) continue;

            RepoDependency first = deps.get(0);
            String packageType = first.getPackageType() != null ? first.getPackageType() : "MAVEN";
            String groupId = first.getGroupId() != null ? first.getGroupId() : "";
            String artifactId = first.getArtifactId() != null ? first.getArtifactId() : "";
            String displayName = "NPM".equalsIgnoreCase(packageType) ? artifactId : (groupId + ":" + artifactId);
            String depNodeId = "dep-" + entry.getKey();

            Set<String> versions = new TreeSet<>();
            Set<Long> uniqueRepoIds = new HashSet<>();

            for (RepoDependency d : deps) {
                if (d.getVersion() != null && !d.getVersion().isBlank()) {
                    versions.add(d.getVersion());
                }
                if (d.getRepository() != null) {
                    uniqueRepoIds.add(d.getRepository().getId());

                    Map<String, Object> edge = new HashMap<>();
                    edge.put("id", "e-" + d.getRepository().getId() + "-" + d.getId());
                    edge.put("source", "repo-" + d.getRepository().getId());
                    edge.put("target", depNodeId);
                    edge.put("version", d.getVersion() != null ? d.getVersion() : "unspecified");
                    edge.put("scope", d.getScope() != null ? d.getScope() : "compile");
                    edge.put("isDev", Boolean.TRUE.equals(d.getIsDev()));
                    edge.put("packageType", packageType);
                    edges.add(edge);
                }
            }

            boolean isDivergent = versions.size() > 1;

            Map<String, Object> depNode = new HashMap<>();
            depNode.put("id", depNodeId);
            depNode.put("label", displayName);
            depNode.put("artifactId", artifactId);
            depNode.put("groupId", groupId);
            depNode.put("nodeCategory", "DEPENDENCY");
            depNode.put("ecosystem", packageType);
            depNode.put("versionCount", versions.size());
            depNode.put("versions", new ArrayList<>(versions));
            depNode.put("isDivergent", isDivergent);
            depNode.put("repoCount", uniqueRepoIds.size());
            nodes.add(depNode);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("mode", "BIPARTITE_ECOSYSTEM");
        response.put("nodes", nodes);
        response.put("edges", edges);
        response.put("totalNodes", nodes.size());
        response.put("totalEdges", edges.size());
        response.put("totalRepositories", repositories.size());
        response.put("totalDependencies", groupedDeps.size());
        return response;
    }
}
