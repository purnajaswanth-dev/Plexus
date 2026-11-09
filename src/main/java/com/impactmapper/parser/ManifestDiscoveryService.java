package com.impactmapper.parser;

import com.impactmapper.dto.ParsedDep;
import com.impactmapper.service.GitHubService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ManifestDiscoveryService {

    private final List<ManifestParser> parsers;

    private static final Set<String> IGNORED_DIRECTORY_SEGMENTS = Set.of(
            ".git", "node_modules", "target", "build", "dist", ".venv", "vendor",
            ".idea", ".vscode", ".mvn", "__pycache__", ".gradle"
    );

    /**
     * Finds and parses all supported manifest files using GitHubService to fetch file contents.
     */
    public ManifestDiscoveryResult discoverAndParse(GitHubService gitHubService, String owner, String repo,
                                                   String branch, List<String> treePaths) {
        List<String> candidatePaths = findCandidateManifestPaths(treePaths);
        log.info("Discovered {} candidate manifest files for {}/{}: {}", candidatePaths.size(), owner, repo, candidatePaths);

        Map<String, String> fetchedContents = new LinkedHashMap<>();
        for (String path : candidatePaths) {
            try {
                String content = gitHubService.fetchFileContent(owner, repo, branch, path);
                if (content != null && !content.isBlank()) {
                    fetchedContents.put(path, content);
                }
            } catch (Exception e) {
                log.warn("Failed to fetch manifest content for {}/{} at {}: {}", owner, repo, path, e.getMessage());
            }
        }

        return parseManifests(fetchedContents);
    }

    /**
     * Parses provided manifest file contents directly (useful for tests or pre-fetched content).
     */
    public ManifestDiscoveryResult parseManifests(Map<String, String> manifestContents) {
        List<ParsedDep> allDeps = new ArrayList<>();
        List<ManifestParseResult> results = new ArrayList<>();
        Set<String> ecosystems = new LinkedHashSet<>();
        List<String> manifestPaths = new ArrayList<>();

        for (Map.Entry<String, String> entry : manifestContents.entrySet()) {
            String path = entry.getKey();
            String content = entry.getValue();

            // Find matching parser
            ManifestParser matchedParser = parsers.stream()
                    .filter(p -> p.supports(path))
                    .findFirst()
                    .orElse(null);

            if (matchedParser != null) {
                manifestPaths.add(path);
                ManifestParseResult res = matchedParser.parse(path, content);
                results.add(res);

                if (res.isSuccess() && !res.getDependencies().isEmpty()) {
                    ecosystems.add(res.getEcosystem());
                    allDeps.addAll(res.getDependencies());
                } else if (res.isSuccess()) {
                    // Even if 0 dependencies declared, ecosystem was detected
                    ecosystems.add(res.getEcosystem());
                }
            }
        }

        boolean hasManifests = !manifestPaths.isEmpty();
        boolean isMonorepo = detectMonorepo(manifestPaths);
        String primaryEcosystem = determinePrimaryEcosystem(ecosystems);

        return ManifestDiscoveryResult.builder()
                .allDependencies(allDeps)
                .manifestResults(results)
                .ecosystems(ecosystems)
                .manifestPaths(manifestPaths)
                .primaryEcosystem(primaryEcosystem)
                .isMonorepo(isMonorepo)
                .hasManifests(hasManifests)
                .build();
    }

    /**
     * Identifies potential manifest paths from the complete git tree, excluding build and cache directories.
     */
    public List<String> findCandidateManifestPaths(List<String> treePaths) {
        if (treePaths == null) return Collections.emptyList();

        List<String> candidates = new ArrayList<>();
        for (String path : treePaths) {
            if (path == null || path.isBlank()) continue;

            String normalized = path.replace("\\", "/");
            if (isIgnoredPath(normalized)) {
                continue;
            }

            boolean isCandidate = parsers.stream().anyMatch(p -> p.supports(normalized));
            if (isCandidate) {
                candidates.add(normalized);
            }
        }

        // Sort candidates: root files first, then shallow directories, then deep directories
        candidates.sort(Comparator.comparingInt(this::getPathDepth).thenComparing(String::compareTo));
        return candidates;
    }

    private boolean isIgnoredPath(String path) {
        String[] segments = path.split("/");
        for (int i = 0; i < segments.length - 1; i++) {
            if (IGNORED_DIRECTORY_SEGMENTS.contains(segments[i])) {
                return true;
            }
        }
        return false;
    }

    private int getPathDepth(String path) {
        int count = 0;
        for (char c : path.toCharArray()) {
            if (c == '/') count++;
        }
        return count;
    }

    private boolean detectMonorepo(List<String> manifestPaths) {
        if (manifestPaths == null || manifestPaths.size() <= 1) {
            return false;
        }

        // Check if there are manifests in different directories
        Set<String> directories = new HashSet<>();
        for (String path : manifestPaths) {
            int lastSlash = path.lastIndexOf('/');
            if (lastSlash != -1) {
                directories.add(path.substring(0, lastSlash));
            } else {
                directories.add(""); // root
            }
        }

        // If manifests exist in 2 or more distinct directories, or there are multiple manifests
        return directories.size() > 1 || manifestPaths.size() > 1;
    }

    private String determinePrimaryEcosystem(Set<String> ecosystems) {
        if (ecosystems.isEmpty()) {
            return "NONE";
        }
        if (ecosystems.size() == 1) {
            return ecosystems.iterator().next();
        }
        return "MULTI_ECOSYSTEM";
    }
}

