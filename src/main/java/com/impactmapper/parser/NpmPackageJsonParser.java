package com.impactmapper.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.impactmapper.dto.ParsedDep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class NpmPackageJsonParser implements ManifestParser {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(String filePath) {
        if (filePath == null) return false;
        String normalized = filePath.replace("\\", "/");
        return (normalized.endsWith("/package.json") || normalized.equals("package.json"))
                && !normalized.contains("node_modules/");
    }

    @Override
    public String getEcosystem() {
        return "NPM";
    }

    @Override
    public ManifestParseResult parse(String filePath, String content) {
        List<ParsedDep> deps = new ArrayList<>();
        List<String> diagnostics = new ArrayList<>();
        Map<String, Object> metadata = new HashMap<>();

        try {
            JsonNode root = objectMapper.readTree(content);

            if (root.has("name")) {
                metadata.put("projectName", root.get("name").asText());
            }
            if (root.has("version")) {
                metadata.put("projectVersion", root.get("version").asText());
            }

            // dependencies (runtime)
            parseDepGroup(root, "dependencies", "runtime", false, filePath, deps);

            // devDependencies
            parseDepGroup(root, "devDependencies", "dev", true, filePath, deps);

            // peerDependencies
            parseDepGroup(root, "peerDependencies", "peer", false, filePath, deps);

            // optionalDependencies
            parseDepGroup(root, "optionalDependencies", "optional", false, filePath, deps);

            return ManifestParseResult.builder()
                    .manifestPath(filePath)
                    .ecosystem(getEcosystem())
                    .dependencies(deps)
                    .success(true)
                    .diagnostics(diagnostics)
                    .metadata(metadata)
                    .build();

        } catch (Exception e) {
            log.warn("Failed to parse package.json at {}: {}", filePath, e.getMessage());
            return ManifestParseResult.failure(filePath, getEcosystem(), "Failed to parse package.json: " + e.getMessage());
        }
    }

    private void parseDepGroup(JsonNode root, String fieldName, String scope, boolean isDev,
                               String manifestPath, List<ParsedDep> deps) {
        if (!root.has(fieldName) || !root.get(fieldName).isObject()) {
            return;
        }

        JsonNode depNode = root.get(fieldName);
        depNode.fields().forEachRemaining(entry -> {
            String pkgName = entry.getKey().trim();
            String rawVersion = entry.getValue().asText();
            String cleanedVersion = cleanVersion(rawVersion);

            deps.add(ParsedDep.builder()
                    .groupId("npm")
                    .artifactId(pkgName)
                    .version(cleanedVersion)
                    .scope(scope)
                    .isDev(isDev)
                    .packageType("NPM")
                    .manifestPath(manifestPath)
                    .build());
        });
    }

    public static String cleanVersion(String version) {
        if (version == null || version.isBlank()) {
            return "unknown";
        }
        String cleaned = version.trim();
        // Remove git/url prefixes if npm points to a repo
        if (cleaned.startsWith("git+") || cleaned.startsWith("github:") || cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
            return cleaned;
        }
        // Remove range qualifiers (^, ~, >=, <=, >, <, =)
        cleaned = cleaned.replaceAll("^[~^><= ]+", "");
        // If it starts with v1.2.3, strip 'v'
        if (cleaned.matches("^v\\d+.*")) {
            cleaned = cleaned.substring(1);
        }
        return cleaned.isBlank() ? "unknown" : cleaned;
    }
}

