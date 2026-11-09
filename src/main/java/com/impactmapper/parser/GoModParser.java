package com.impactmapper.parser;

import com.impactmapper.dto.ParsedDep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class GoModParser implements ManifestParser {

    private static final Pattern REQUIRE_LINE = Pattern.compile(
            "^(?:require\\s+)?([a-zA-Z0-9_./-]+)\\s+([a-zA-Z0-9_.-]+)(?:\\s*//\\s*(indirect))?.*"
    );

    @Override
    public boolean supports(String filePath) {
        if (filePath == null) return false;
        String normalized = filePath.replace("\\", "/");
        return normalized.endsWith("/go.mod") || normalized.equals("go.mod");
    }

    @Override
    public String getEcosystem() {
        return "GO";
    }

    @Override
    public ManifestParseResult parse(String filePath, String content) {
        List<ParsedDep> deps = new ArrayList<>();
        List<String> diagnostics = new ArrayList<>();
        Map<String, Object> metadata = new HashMap<>();

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String line;
            boolean inRequireBlock = false;

            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("//")) {
                    continue;
                }

                if (line.startsWith("module ")) {
                    String moduleName = line.substring("module ".length()).trim();
                    metadata.put("moduleName", moduleName);
                    continue;
                }

                if (line.equals("require (")) {
                    inRequireBlock = true;
                    continue;
                }

                if (inRequireBlock && line.equals(")")) {
                    inRequireBlock = false;
                    continue;
                }

                if (inRequireBlock || line.startsWith("require ")) {
                    Matcher matcher = REQUIRE_LINE.matcher(line);
                    if (matcher.matches()) {
                        String fullPath = matcher.group(1).trim();
                        String version = matcher.group(2).trim();
                        boolean isIndirect = "indirect".equalsIgnoreCase(matcher.group(3));

                        // Split full module path into groupId and artifactId
                        String groupId;
                        String artifactId;
                        int lastSlash = fullPath.lastIndexOf('/');
                        if (lastSlash != -1) {
                            groupId = fullPath.substring(0, lastSlash);
                            artifactId = fullPath.substring(lastSlash + 1);
                        } else {
                            groupId = "go";
                            artifactId = fullPath;
                        }

                        // Clean version (e.g. v1.9.1 -> 1.9.1)
                        String cleanVersion = version.startsWith("v") ? version.substring(1) : version;

                        deps.add(ParsedDep.builder()
                                .groupId(groupId)
                                .artifactId(artifactId)
                                .version(cleanVersion)
                                .scope(isIndirect ? "indirect" : "direct")
                                .isDev(false)
                                .packageType("GO")
                                .manifestPath(filePath)
                                .build());
                    }
                }
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
            log.warn("Failed to parse go.mod at {}: {}", filePath, e.getMessage());
            return ManifestParseResult.failure(filePath, getEcosystem(), "Failed to parse go.mod: " + e.getMessage());
        }
    }
}

