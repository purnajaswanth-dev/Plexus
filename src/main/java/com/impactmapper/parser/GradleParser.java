package com.impactmapper.parser;

import com.impactmapper.dto.ParsedDep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class GradleParser implements ManifestParser {

    // Matches standard Gradle dependency configurations:
    // e.g. implementation 'org.springframework.boot:spring-boot-starter-web:3.3.5'
    // or testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
    // or api "com.google.guava:guava:32.1.2-jre"
    private static final Pattern STRING_DEP_PATTERN = Pattern.compile(
            "\\b(implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly|annotationProcessor)\\s*(?:\\(|\\s)\\s*['\"]([^'\"]+)['\"]\\s*\\)?"
    );

    // Matches map-style Gradle dependency:
    // e.g. implementation group: 'org.apache.commons', name: 'commons-lang3', version: '3.12.0'
    private static final Pattern MAP_DEP_PATTERN = Pattern.compile(
            "\\b(implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly)\\s+group\\s*:\\s*['\"]([^'\"]+)['\"]\\s*,\\s*name\\s*:\\s*['\"]([^'\"]+)['\"](?:\\s*,\\s*version\\s*:\\s*['\"]([^'\"]+)['\"])?"
    );

    // Matches multi-project submodules in settings.gradle: include 'subproject-a', ':subproject-b'
    private static final Pattern SETTINGS_INCLUDE_PATTERN = Pattern.compile(
            "include\\s+['\"]([^'\"]+)['\"]"
    );

    @Override
    public boolean supports(String filePath) {
        if (filePath == null) return false;
        String normalized = filePath.replace('\\', '/').toLowerCase();
        return normalized.endsWith("build.gradle") ||
               normalized.endsWith("build.gradle.kts") ||
               normalized.endsWith("settings.gradle") ||
               normalized.endsWith("settings.gradle.kts");
    }

    @Override
    public String getEcosystem() {
        return "GRADLE";
    }

    @Override
    public ManifestParseResult parse(String filePath, String content) {
        if (content == null || content.isBlank()) {
            return ManifestParseResult.failure(filePath, getEcosystem(), "Gradle file is empty");
        }

        List<ParsedDep> dependencies = new ArrayList<>();
        List<String> diagnostics = new ArrayList<>();
        Map<String, Object> metadata = new HashMap<>();

        String normalized = filePath.replace('\\', '/').toLowerCase();
        boolean isSettings = normalized.endsWith("settings.gradle") || normalized.endsWith("settings.gradle.kts");

        if (isSettings) {
            List<String> subprojects = new ArrayList<>();
            Matcher settingsMatcher = SETTINGS_INCLUDE_PATTERN.matcher(content);
            while (settingsMatcher.find()) {
                String sub = settingsMatcher.group(1).replace(":", "").trim();
                if (!sub.isBlank()) {
                    subprojects.add(sub);
                }
            }
            metadata.put("subprojects", subprojects);
            metadata.put("isSettings", true);
            return ManifestParseResult.builder()
                    .manifestPath(filePath)
                    .ecosystem(getEcosystem())
                    .dependencies(Collections.emptyList())
                    .success(true)
                    .diagnostics(diagnostics)
                    .metadata(metadata)
                    .build();
        }

        // Parse String Notation Dependencies
        Matcher strMatcher = STRING_DEP_PATTERN.matcher(content);
        while (strMatcher.find()) {
            String config = strMatcher.group(1);
            String coord = strMatcher.group(2).trim();

            // Ignore project-local dependencies e.g. project(':core')
            if (coord.startsWith("project(") || coord.startsWith(":")) {
                continue;
            }

            String[] parts = coord.split(":");
            if (parts.length >= 2) {
                String groupId = parts[0].trim();
                String artifactId = parts[1].trim();
                String version = parts.length >= 3 ? parts[2].trim() : "MANAGED_OR_LATEST";

                boolean isDev = config.toLowerCase().contains("test") || config.equalsIgnoreCase("compileOnly");
                String scope = determineScope(config);

                dependencies.add(ParsedDep.builder()
                        .groupId(groupId)
                        .artifactId(artifactId)
                        .version(version)
                        .scope(scope)
                        .isDev(isDev)
                        .packageType("GRADLE")
                        .manifestPath(filePath)
                        .build());
            }
        }

        // Parse Map Notation Dependencies
        Matcher mapMatcher = MAP_DEP_PATTERN.matcher(content);
        while (mapMatcher.find()) {
            String config = mapMatcher.group(1);
            String groupId = mapMatcher.group(2).trim();
            String artifactId = mapMatcher.group(3).trim();
            String version = mapMatcher.group(4) != null ? mapMatcher.group(4).trim() : "MANAGED_OR_LATEST";

            boolean isDev = config.toLowerCase().contains("test") || config.equalsIgnoreCase("compileOnly");
            String scope = determineScope(config);

            dependencies.add(ParsedDep.builder()
                    .groupId(groupId)
                    .artifactId(artifactId)
                    .version(version)
                    .scope(scope)
                    .isDev(isDev)
                    .packageType("GRADLE")
                    .manifestPath(filePath)
                    .build());
        }

        return ManifestParseResult.builder()
                .manifestPath(filePath)
                .ecosystem(getEcosystem())
                .dependencies(dependencies)
                .success(true)
                .diagnostics(diagnostics)
                .metadata(Map.of("parsedCount", dependencies.size()))
                .build();
    }

    private String determineScope(String config) {
        String lower = config.toLowerCase();
        if (lower.contains("test")) return "test";
        if (lower.contains("compileonly")) return "provided";
        if (lower.contains("runtimeonly")) return "runtime";
        return "compile";
    }
}

