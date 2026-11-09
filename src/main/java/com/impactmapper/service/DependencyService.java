package com.impactmapper.service;

import com.impactmapper.entity.RepoDependency;
import com.impactmapper.repository.RepoDependencyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DependencyService {

    private final RepoDependencyRepository dependencyRepository;
    private final com.impactmapper.repository.RepositoryRepository repositoryRepository;

    public static class LibrarySummary {
        private String key;
        private String groupId;
        private String artifactId;
        private String displayName;
        private String packageType;
        private int repoCount;
        private int versionCount;
        private List<String> versions;
        private boolean isConsistent;
        private List<Map<String, Object>> repositories;

        public LibrarySummary() {}

        public LibrarySummary(String key, String groupId, String artifactId, String displayName,
                              String packageType, int repoCount, int versionCount,
                              List<String> versions, boolean isConsistent,
                              List<Map<String, Object>> repositories) {
            this.key = key;
            this.groupId = groupId;
            this.artifactId = artifactId;
            this.displayName = displayName;
            this.packageType = packageType;
            this.repoCount = repoCount;
            this.versionCount = versionCount;
            this.versions = versions;
            this.isConsistent = isConsistent;
            this.repositories = repositories;
        }

        public String getKey() { return key; }
        public String getGroupId() { return groupId; }
        public String getArtifactId() { return artifactId; }
        public String getDisplayName() { return displayName; }
        public String getPackageType() { return packageType; }
        public int getRepoCount() { return repoCount; }
        public int getVersionCount() { return versionCount; }
        public List<String> getVersions() { return versions; }
        public boolean isConsistent() { return isConsistent; }
        public List<Map<String, Object>> getRepositories() { return repositories; }
    }

    public List<LibrarySummary> getLibraries(String query, String type, String consistency, Long repoId) {
        Optional<com.impactmapper.security.UserPrincipal> currentUser = com.impactmapper.security.SecurityUtils.getCurrentUser();
        List<RepoDependency> allDeps;

        if (currentUser.isPresent()) {
            Set<Long> userRepoIds = repositoryRepository.findByOwnerIdOrderByAddedAtDesc(currentUser.get().getAppUserId()).stream()
                    .map(com.impactmapper.entity.Repository::getId)
                    .collect(Collectors.toSet());
            if (userRepoIds.isEmpty()) {
                return Collections.emptyList();
            }
            if (repoId != null) {
                if (!userRepoIds.contains(repoId)) {
                    return Collections.emptyList();
                }
                allDeps = new ArrayList<>(dependencyRepository.findByRepositoryId(repoId));
            } else {
                allDeps = new ArrayList<>(dependencyRepository.findByRepositoryIdIn(userRepoIds));
            }
        } else {
            if (repoId != null) {
                allDeps = new ArrayList<>(dependencyRepository.findByRepositoryId(repoId));
                if (allDeps.isEmpty()) {
                    allDeps = new ArrayList<>(dependencyRepository.findAllWithRepository());
                    allDeps.removeIf(d -> d.getRepository() == null || !repoId.equals(d.getRepository().getId()));
                }
            } else {
                allDeps = new ArrayList<>(dependencyRepository.findAllWithRepository());
            }
        }

        // Group by library key (packageType + "::" + groupId + "::" + artifactId)
        Map<String, List<RepoDependency>> grouped = allDeps.stream().collect(
                Collectors.groupingBy(d -> {
                    String pType = d.getPackageType() != null ? d.getPackageType() : "MAVEN";
                    String gId = d.getGroupId() != null ? d.getGroupId() : "";
                    String aId = d.getArtifactId() != null ? d.getArtifactId() : "";
                    return pType + "::" + gId + "::" + aId;
                })
        );

        List<LibrarySummary> result = new ArrayList<>();

        for (Map.Entry<String, List<RepoDependency>> entry : grouped.entrySet()) {
            List<RepoDependency> deps = entry.getValue();
            if (deps.isEmpty()) continue;

            RepoDependency first = deps.get(0);
            String packageType = first.getPackageType() != null ? first.getPackageType() : "MAVEN";
            String groupId = first.getGroupId() != null ? first.getGroupId() : "";
            String artifactId = first.getArtifactId() != null ? first.getArtifactId() : "";
            String displayName = "NPM".equalsIgnoreCase(packageType) ? artifactId : (groupId + ":" + artifactId);

            // Filter by type
            if (type != null && !type.isBlank() && !type.equalsIgnoreCase("ALL")) {
                if (!type.equalsIgnoreCase(packageType)) {
                    continue;
                }
            }

            // Filter by query
            if (query != null && !query.isBlank()) {
                String qLower = query.toLowerCase().trim();
                boolean matches = displayName.toLowerCase().contains(qLower)
                        || artifactId.toLowerCase().contains(qLower)
                        || groupId.toLowerCase().contains(qLower);
                if (!matches) {
                    continue;
                }
            }

            // Repositories using this library
            Map<Long, Map<String, Object>> repoMap = new HashMap<>();
            Set<String> versionsSet = new TreeSet<>();

            for (RepoDependency d : deps) {
                if (d.getRepository() != null) {
                    Map<String, Object> rInfo = new HashMap<>();
                    rInfo.put("id", d.getRepository().getId());
                    rInfo.put("repoName", d.getRepository().getRepoName());
                    rInfo.put("repoUrl", d.getRepository().getRepoUrl());
                    rInfo.put("version", d.getVersion());
                    rInfo.put("scope", d.getScope());
                    repoMap.put(d.getRepository().getId(), rInfo);
                }
                if (d.getVersion() != null && !d.getVersion().isBlank()) {
                    versionsSet.add(d.getVersion());
                }
            }

            List<String> versionsList = new ArrayList<>(versionsSet);
            boolean isConsistent = versionsList.size() <= 1;

            // Filter by consistency
            if ("consistent".equalsIgnoreCase(consistency) && !isConsistent) {
                continue;
            }
            if ("divergent".equalsIgnoreCase(consistency) && isConsistent) {
                continue;
            }

            result.add(new LibrarySummary(
                    entry.getKey(),
                    groupId,
                    artifactId,
                    displayName,
                    packageType,
                    repoMap.size(),
                    versionsList.size(),
                    versionsList,
                    isConsistent,
                    new ArrayList<>(repoMap.values())
            ));
        }

        // Sort by repoCount desc, then displayName asc
        result.sort((a, b) -> {
            int cmp = Integer.compare(b.getRepoCount(), a.getRepoCount());
            if (cmp != 0) return cmp;
            return a.getDisplayName().compareToIgnoreCase(b.getDisplayName());
        });

        return result;
    }

    public Map<String, Object> getLibraryDetail(String artifactId, String groupId, String packageType) {
        List<RepoDependency> rawDeps;
        if (groupId != null && !groupId.isBlank()) {
            rawDeps = dependencyRepository.findByArtifactIdAndGroupId(artifactId, groupId);
        } else {
            rawDeps = dependencyRepository.findByArtifactId(artifactId);
        }

        final List<RepoDependency> deps = new ArrayList<>(rawDeps);
        if (packageType != null && !packageType.isBlank()) {
            deps.removeIf(d -> !packageType.equalsIgnoreCase(d.getPackageType()));
        }

        com.impactmapper.security.SecurityUtils.getCurrentUser().ifPresent(user -> {
            Set<Long> userRepoIds = repositoryRepository.findByOwnerIdOrderByAddedAtDesc(user.getAppUserId()).stream()
                    .map(com.impactmapper.entity.Repository::getId)
                    .collect(Collectors.toSet());
            deps.removeIf(d -> d.getRepository() == null || !userRepoIds.contains(d.getRepository().getId()));
        });

        if (deps.isEmpty()) {
            return Collections.emptyMap();
        }

        RepoDependency first = deps.get(0);
        String resolvedPackageType = first.getPackageType() != null ? first.getPackageType() : "MAVEN";
        String resolvedGroupId = first.getGroupId() != null ? first.getGroupId() : "";
        String resolvedArtifactId = first.getArtifactId() != null ? first.getArtifactId() : "";
        String displayName = "NPM".equalsIgnoreCase(resolvedPackageType)
                ? resolvedArtifactId
                : (resolvedGroupId + ":" + resolvedArtifactId);

        Set<String> allVersions = new TreeSet<>();
        Map<String, List<String>> versionBreakdown = new HashMap<>();
        List<Map<String, Object>> usages = new ArrayList<>();

        for (RepoDependency d : deps) {
            String v = d.getVersion() != null ? d.getVersion() : "unknown";
            allVersions.add(v);

            String repoName = d.getRepository() != null ? d.getRepository().getRepoName() : "Unknown";
            versionBreakdown.computeIfAbsent(v, k -> new ArrayList<>()).add(repoName);

            Map<String, Object> usage = new HashMap<>();
            usage.put("id", d.getId());
            usage.put("version", v);
            usage.put("scope", d.getScope() != null ? d.getScope() : "compile");
            usage.put("isDev", Boolean.TRUE.equals(d.getIsDev()));
            if (d.getRepository() != null) {
                usage.put("repoId", d.getRepository().getId());
                usage.put("repoName", d.getRepository().getRepoName());
                usage.put("repoUrl", d.getRepository().getRepoUrl());
                usage.put("lastIndexed", d.getRepository().getLastIndexed());
            }
            usages.add(usage);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("displayName", displayName);
        response.put("groupId", resolvedGroupId);
        response.put("artifactId", resolvedArtifactId);
        response.put("packageType", resolvedPackageType);
        response.put("repoCount", usages.size());
        response.put("versionCount", allVersions.size());
        response.put("versions", new ArrayList<>(allVersions));
        response.put("isConsistent", allVersions.size() <= 1);
        response.put("versionBreakdown", versionBreakdown);
        response.put("usages", usages);

        return response;
    }
}

