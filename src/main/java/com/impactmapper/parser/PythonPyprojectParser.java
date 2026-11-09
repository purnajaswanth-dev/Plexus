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
public class PythonPyprojectParser implements ManifestParser {

    private static final Pattern PEP621_DEP_PATTERN = Pattern.compile(
            "^\"([a-zA-Z0-9_.-]+)(?:\\s*([=><~^!]+)\\s*([a-zA-Z0-9_.*+-]+))?.*\",?$"
    );
    private static final Pattern KEY_VAL_PATTERN = Pattern.compile(
            "^([a-zA-Z0-9_.-]+)\\s*=\\s*(?:\"([^\"]+)\"|'([^']+)'|\\{.*version\\s*=\\s*\"([^\"]+)\".*\\}|\\*).*$"
    );

    @Override
    public boolean supports(String filePath) {
        if (filePath == null) return false;
        String normalized = filePath.replace("\\", "/").toLowerCase();
        return (normalized.endsWith("pyproject.toml") || normalized.endsWith("pipfile"))
                && !normalized.contains(".venv");
    }

    @Override
    public String getEcosystem() {
        return "PYTHON";
    }

    @Override
    public ManifestParseResult parse(String filePath, String content) {
        List<ParsedDep> deps = new ArrayList<>();
        List<String> diagnostics = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String currentSection = "";
            String line;

            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                // Section header like [tool.poetry.dependencies] or [packages]
                if (line.startsWith("[") && line.endsWith("]")) {
                    currentSection = line.substring(1, line.length() - 1).trim().toLowerCase();
                    continue;
                }

                boolean isDev = currentSection.contains("dev")
                        || currentSection.contains("test")
                        || currentSection.contains("optional-dependencies");

                boolean isRelevantSection = currentSection.contains("dependencies")
                        || currentSection.equals("packages")
                        || currentSection.equals("dev-packages");

                if (!isRelevantSection) {
                    continue;
                }

                // Check PEP 621 list item (e.g. "requests>=2.25.0",)
                Matcher pepMatcher = PEP621_DEP_PATTERN.matcher(line);
                if (pepMatcher.matches()) {
                    String pkg = pepMatcher.group(1).trim();
                    String version = pepMatcher.group(3);
                    String resolvedVersion = (version != null && !version.isBlank()) ? version.trim() : "LATEST";

                    deps.add(ParsedDep.builder()
                            .groupId("pypi")
                            .artifactId(pkg)
                            .version(resolvedVersion)
                            .scope(isDev ? "dev" : "runtime")
                            .isDev(isDev)
                            .packageType("PYTHON")
                            .manifestPath(filePath)
                            .build());
                    continue;
                }

                // Check key-value format (Poetry / Pipfile e.g. requests = "^2.28" or requests = "*")
                Matcher kvMatcher = KEY_VAL_PATTERN.matcher(line);
                if (kvMatcher.matches()) {
                    String pkg = kvMatcher.group(1).trim();
                    if (pkg.equalsIgnoreCase("python")) {
                        continue; // skip python version constraint
                    }
                    String version = kvMatcher.group(2);
                    if (version == null) version = kvMatcher.group(3);
                    if (version == null) version = kvMatcher.group(4);
                    if (version == null || version.equals("*")) version = "LATEST";

                    deps.add(ParsedDep.builder()
                            .groupId("pypi")
                            .artifactId(pkg)
                            .version(cleanVersion(version))
                            .scope(isDev ? "dev" : "runtime")
                            .isDev(isDev)
                            .packageType("PYTHON")
                            .manifestPath(filePath)
                            .build());
                }
            }

            return ManifestParseResult.builder()
                    .manifestPath(filePath)
                    .ecosystem(getEcosystem())
                    .dependencies(deps)
                    .success(true)
                    .diagnostics(diagnostics)
                    .build();

        } catch (Exception e) {
            log.warn("Failed to parse python toml/pipfile at {}: {}", filePath, e.getMessage());
            return ManifestParseResult.failure(filePath, getEcosystem(), "Failed to parse: " + e.getMessage());
        }
    }

    private String cleanVersion(String version) {
        if (version == null || version.isBlank() || version.equals("*")) return "LATEST";
        return version.replaceAll("^[~^><= ]+", "").trim();
    }
}

