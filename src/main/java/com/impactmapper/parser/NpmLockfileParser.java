package com.impactmapper.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.impactmapper.dto.ParsedDep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

@Slf4j
@Component
public class NpmLockfileParser implements ManifestParser {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(String filePath) {
        if (filePath == null) return false;
        String normalized = filePath.replace("\\", "/");
        return (normalized.endsWith("/package-lock.json") || normalized.equals("package-lock.json"))
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
                metadata.put("name", root.get("name").asText());
            }
            if (root.has("lockfileVersion")) {
                metadata.put("lockfileVersion", root.get("lockfileVersion").asInt());
            }

            // In npm lockfile v2/v3, packages["node_modules/<name>"] contains direct and transitive dependencies
            if (root.has("packages")) {
                JsonNode packages = root.get("packages");
                packages.fields().forEachRemaining(entry -> {
                    String key = entry.getKey();
                    if (key.startsWith("node_modules/")) {
                        String pkgName = key.substring("node_modules/".length());
                        // Only include direct sub-packages (skip deep nested node_modules/foo/node_modules/bar)
                        if (!pkgName.contains("node_modules/")) {
                            JsonNode pkgObj = entry.getValue();
                            String version = pkgObj.has("version") ? pkgObj.get("version").asText() : "unknown";
                            boolean isDev = pkgObj.has("dev") && pkgObj.get("dev").asBoolean();
                            String scope = isDev ? "dev" : "runtime";

                            deps.add(ParsedDep.builder()
                                    .groupId("npm")
                                    .artifactId(pkgName)
                                    .version(version)
                                    .scope(scope)
                                    .isDev(isDev)
                                    .packageType("NPM")
                                    .manifestPath(filePath)
                                    .build());
                        }
                    }
                });
            } else if (root.has("dependencies")) {
                // Lockfile v1 format
                JsonNode dependencies = root.get("dependencies");
                dependencies.fields().forEachRemaining(entry -> {
                    String pkgName = entry.getKey();
                    JsonNode pkgObj = entry.getValue();
                    String version = pkgObj.has("version") ? pkgObj.get("version").asText() : "unknown";
                    boolean isDev = pkgObj.has("dev") && pkgObj.get("dev").asBoolean();
                    String scope = isDev ? "dev" : "runtime";

                    deps.add(ParsedDep.builder()
                            .groupId("npm")
                            .artifactId(pkgName)
                            .version(version)
                            .scope(scope)
                            .isDev(isDev)
                            .packageType("NPM")
                            .manifestPath(filePath)
                            .build());
                });
            }

            return ManifestParseResult.builder()
                    .manifestPath(filePath)
                    .ecosystem(getEcosystem())
                    .dependencies(deps)
                    .success(true)
                    .diagnostics(diagnostics)
                    .metadata(metadata)
                    .build();

        } catch (Exception e) {
            log.warn("Failed to parse package-lock.json at {}: {}", filePath, e.getMessage());
            return ManifestParseResult.failure(filePath, getEcosystem(), "Failed to parse package-lock.json: " + e.getMessage());
        }
    }
}

