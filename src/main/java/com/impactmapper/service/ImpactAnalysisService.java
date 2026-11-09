package com.impactmapper.service;

import com.impactmapper.dto.ImpactAnalysisResult;
import com.impactmapper.dto.ImpactFinding;
import com.impactmapper.dto.ImpactedRepo;
import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.RepoDependencyRepository;
import lombok.RequiredArgsConstructor;
import com.impactmapper.repository.RepositoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ImpactAnalysisService {

    private final RepoDependencyRepository dependencyRepository;
    private final RepositoryRepository repositoryRepository;

    public ImpactAnalysisService(RepoDependencyRepository dependencyRepository) {
        this(dependencyRepository, null);
    }

    @Autowired
    public ImpactAnalysisService(RepoDependencyRepository dependencyRepository, @Autowired(required = false) RepositoryRepository repositoryRepository) {
        this.dependencyRepository = dependencyRepository;
        this.repositoryRepository = repositoryRepository;
    }

    public ImpactAnalysisResult analyzeImpact(String groupId, String artifactId, String fromVersion, String toVersion) {
        if (artifactId == null || artifactId.trim().isEmpty()) {
            throw new IllegalArgumentException("Artifact/Library name is required");
        }
        if (toVersion == null || toVersion.trim().isEmpty()) {
            throw new IllegalArgumentException("Target version is required");
        }

        List<RepoDependency> rawDeps;
        if (groupId == null || groupId.trim().isEmpty() || "npm".equalsIgnoreCase(groupId.trim())) {
            rawDeps = dependencyRepository.findByArtifactId(artifactId.trim());
        } else {
            rawDeps = dependencyRepository.findByArtifactIdAndGroupId(artifactId.trim(), groupId.trim());
        }

        final List<RepoDependency> affectedDeps = new ArrayList<>(rawDeps);
        if (repositoryRepository != null) {
            com.impactmapper.security.SecurityUtils.getCurrentUser().ifPresent(user -> {
                Set<Long> userRepoIds = repositoryRepository.findByOwnerIdOrderByAddedAtDesc(user.getAppUserId()).stream()
                        .map(Repository::getId)
                        .collect(Collectors.toSet());
                affectedDeps.removeIf(d -> d.getRepository() == null || !userRepoIds.contains(d.getRepository().getId()));
            });
        }

        List<ImpactedRepo> impactedRepos = new ArrayList<>();
        List<ImpactFinding> findings = new ArrayList<>();

        for (RepoDependency dep : affectedDeps) {
            Repository repo = dep.getRepository();
            if (repo == null) continue;

            String currentVersion = dep.getVersion() != null ? dep.getVersion() : "unknown";
            String impactLevel = determineImpactLevel(currentVersion, fromVersion, toVersion);
            String reason = determineReason(impactLevel, currentVersion, fromVersion, toVersion);
            String recommendedAction = determineRecommendedAction(impactLevel);

            impactedRepos.add(ImpactedRepo.builder()
                    .repoId(repo.getId())
                    .repoName(repo.getRepoName())
                    .repoUrl(repo.getRepoUrl())
                    .currentVersion(currentVersion)
                    .targetVersion(toVersion)
                    .impactLevel(impactLevel)
                    .reason(reason)
                    .recommendedAction(recommendedAction)
                    .dependencyScope(dep.getScope() != null ? dep.getScope() : "compile")
                    .build());

            // Build structured evidence-based finding
            String category;
            String evidenceLevel;
            String riskImplication;

            if ("BREAKING".equals(impactLevel)) {
                category = "MAJOR_VERSION_TRANSITION";
                evidenceLevel = "LEVEL_2_VERSION_BASED_INFERENCE";
                riskImplication = "Potential breaking API signatures, removed deprecated classes, and framework runtime baseline changes.";
            } else if ("WARNING".equals(impactLevel)) {
                category = "DEPRECATION_GAP";
                evidenceLevel = "LEVEL_2_VERSION_BASED_INFERENCE";
                riskImplication = "Cumulative minor version delta may trigger newly introduced deprecation warnings or configuration schema deprecations.";
            } else {
                category = "VERSION_ALIGNMENT";
                evidenceLevel = "LEVEL_1_DIRECTLY_DETECTED";
                riskImplication = "Backwards-compatible update with low risk of compilation or runtime failure.";
            }

            findings.add(ImpactFinding.builder()
                    .title(String.format("%s: %s (%s -> %s)", impactLevel, repo.getRepoName(), currentVersion, toVersion))
                    .category(category)
                    .affectedRepo(repo.getRepoName())
                    .currentValue(currentVersion)
                    .targetValue(toVersion)
                    .exactEvidence(String.format("Manifest declared %s:%s at version '%s' with scope '%s'",
                            dep.getGroupId(), dep.getArtifactId(), currentVersion, dep.getScope()))
                    .sourceLocation(dep.getPackageType() + " manifest")
                    .explanation(reason)
                    .riskImplication(riskImplication)
                    .recommendedAction(recommendedAction)
                    .evidenceLevel(evidenceLevel)
                    .build());
        }

        List<ImpactedRepo> breaking = impactedRepos.stream()
                .filter(r -> "BREAKING".equals(r.getImpactLevel()))
                .sorted(Comparator.comparing(ImpactedRepo::getRepoName))
                .collect(Collectors.toList());

        List<ImpactedRepo> warning = impactedRepos.stream()
                .filter(r -> "WARNING".equals(r.getImpactLevel()))
                .sorted(Comparator.comparing(ImpactedRepo::getRepoName))
                .collect(Collectors.toList());

        List<ImpactedRepo> safe = impactedRepos.stream()
                .filter(r -> "SAFE".equals(r.getImpactLevel()))
                .sorted(Comparator.comparing(ImpactedRepo::getRepoName))
                .collect(Collectors.toList());

        List<ImpactedRepo> allImpacted = new ArrayList<>();
        allImpacted.addAll(breaking);
        allImpacted.addAll(warning);
        allImpacted.addAll(safe);

        String libName = (groupId != null && !groupId.isBlank() && !"npm".equalsIgnoreCase(groupId))
                ? (groupId + ":" + artifactId)
                : artifactId;

        // Version Difference
        Version vFrom = (fromVersion != null && !fromVersion.isBlank()) ? parseVersion(fromVersion) : parseVersion("0.0.0");
        Version vTo = parseVersion(toVersion);
        String versionDiff = "SAME";
        if (vTo.major > vFrom.major) versionDiff = "MAJOR";
        else if (vTo.major == vFrom.major && vTo.minor > vFrom.minor) versionDiff = "MINOR";
        else if (vTo.major == vFrom.major && vTo.minor == vFrom.minor && vTo.patch > vFrom.patch) versionDiff = "PATCH";

        // Overall Recommendation
        String overallRec;
        String recReason;
        if (!breaking.isEmpty()) {
            overallRec = "INVESTIGATE BEFORE UPGRADING";
            recReason = String.format("Identified %d repository/repositories undergoing major version transitions. API breaking changes and migration guide compliance must be audited before rollout.", breaking.size());
        } else if (!warning.isEmpty()) {
            overallRec = "PROCEED WITH CAUTION";
            recReason = String.format("Detected %d repository/repositories with minor version gaps or baseline discrepancies. Validate deprecations and run regression test suites in staging.", warning.size());
        } else {
            overallRec = "PROCEED";
            recReason = "No breaking or warning heuristics detected across tracked repositories. Safe to proceed with standard CI/CD build validation.";
        }

        String execSummary = String.format(
                "This assessment evaluates upgrading '%s' to target version '%s'. Across %d impacted repository/repositories in the fleet, " +
                "analysis identified %d breaking risk(s), %d warning risk(s), and %d safe upgrade path(s). Recommended decision: %s.",
                libName, toVersion, impactedRepos.size(), breaking.size(), warning.size(), safe.size(), overallRec
        );

        return ImpactAnalysisResult.builder()
                .libraryName(libName)
                .fromVersion(fromVersion != null && !fromVersion.isBlank() ? fromVersion : "current")
                .toVersion(toVersion)
                .totalAffectedRepos(impactedRepos.size())
                .breakingCount(breaking.size())
                .warningCount(warning.size())
                .safeCount(safe.size())
                .breakingRepos(breaking)
                .warningRepos(warning)
                .safeRepos(safe)
                .allImpactedRepos(allImpacted)
                .findings(findings)
                .analysisTime(LocalDateTime.now())
                .methodology("Semantic Versioning (SemVer) heuristic risk assessment. Identifies potential breaking changes based on major/minor version increments rather than byte-level static verification.")
                .overallRecommendation(overallRec)
                .recommendationReason(recReason)
                .executiveSummary(execSummary)
                .versionDifference(versionDiff)
                .build();
    }

    private String determineImpactLevel(String current, String from, String to) {
        Version vCurrent = parseVersion(current);
        Version vFrom = (from != null && !from.isBlank()) ? parseVersion(from) : vCurrent;
        Version vTo = parseVersion(to);

        // If repo is already on target version
        if (vCurrent.major == vTo.major && vCurrent.minor == vTo.minor && vCurrent.patch == vTo.patch) {
            return "SAFE";
        }

        // Major version upgrade from repository's current version
        if (vTo.major > vCurrent.major) {
            return "BREAKING";
        }

        // If repository is older than baseline fromVersion
        if (isOlder(vCurrent, vFrom)) {
            return "WARNING";
        }

        // Minor version gap of 2 or more releases
        if (vTo.major == vCurrent.major && (vTo.minor - vCurrent.minor >= 2)) {
            return "WARNING";
        }

        return "SAFE";
    }

    private String determineReason(String level, String current, String from, String to) {
        Version vCurrent = parseVersion(current);
        Version vTo = parseVersion(to);

        if (vCurrent.major == vTo.major && vCurrent.minor == vTo.minor && vCurrent.patch == vTo.patch) {
            return String.format("Repository is already aligned with target version %s", to);
        }

        if ("BREAKING".equals(level)) {
            return String.format("Major version upgrade from %s to %s - potential API incompatibilities and signature changes expected", current, to);
        }
        if ("WARNING".equals(level)) {
            Version vFrom = (from != null && !from.isBlank()) ? parseVersion(from) : vCurrent;
            if (isOlder(vCurrent, vFrom)) {
                return String.format("Repository version (%s) is older than baseline (%s) - cumulative migrations required", current, from);
            }
            return String.format("Minor version gap (%s -> %s) is 2 or more minor releases apart - deprecations likely", current, to);
        }
        return String.format("Minor or patch update (%s -> %s) within the same major cycle - backwards compatible", current, to);
    }

    private String determineRecommendedAction(String level) {
        if ("BREAKING".equals(level)) {
            return "Audit breaking release notes, upgrade dependencies in a staging branch, and execute full integration tests.";
        }
        if ("WARNING".equals(level)) {
            return "Review deprecation notices and intermediate migration guides before merging.";
        }
        return "Proceed with automated build and standard unit test verification.";
    }

    public static class Version {
        public final int major;
        public final int minor;
        public final int patch;

        public Version(int maj, int min, int pat) {
            this.major = maj;
            this.minor = min;
            this.patch = pat;
        }
    }

    public Version parseVersion(String v) {
        if (v == null || v.isBlank() || "RESOLVED_AT_BUILD_TIME".equalsIgnoreCase(v) || "unknown".equalsIgnoreCase(v)) {
            return new Version(0, 0, 0);
        }
        v = v.replaceAll("^[v^~>=<\\s]+", "");
        String[] parts = v.split("\\.");
        int maj = parts.length > 0 ? safeParseInt(parts[0]) : 0;
        int min = parts.length > 1 ? safeParseInt(parts[1]) : 0;
        int pat = parts.length > 2 ? safeParseInt(parts[2].replaceAll("[^0-9].*", "")) : 0;
        return new Version(maj, min, pat);
    }

    private int safeParseInt(String s) {
        try {
            return Integer.parseInt(s.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 0;
        }
    }

    public boolean isOlder(Version v1, Version v2) {
        if (v1.major < v2.major) return true;
        if (v1.major == v2.major && v1.minor < v2.minor) return true;
        if (v1.major == v2.major && v1.minor == v2.minor && v1.patch < v2.patch) return true;
        return false;
    }
}
