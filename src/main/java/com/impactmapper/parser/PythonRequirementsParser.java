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
public class PythonRequirementsParser implements ManifestParser {

    private static final Pattern DEP_PATTERN = Pattern.compile(
            "^([a-zA-Z0-9_.-]+)(?:\\s*([=><~^!]+)\\s*([a-zA-Z0-9_.*+-]+))?.*"
    );

    @Override
    public boolean supports(String filePath) {
        if (filePath == null) return false;
        String normalized = filePath.replace("\\", "/").toLowerCase();
        return (normalized.endsWith("requirements.txt")
                || normalized.matches(".*/requirements(-.*)?\\.txt$")
                || normalized.matches("requirements(-.*)?\\.txt$")
                || normalized.endsWith("requirements-dev.txt"))
                && !normalized.contains(".venv")
                && !normalized.contains("site-packages");
    }

    @Override
    public String getEcosystem() {
        return "PYTHON";
    }

    @Override
    public ManifestParseResult parse(String filePath, String content) {
        List<ParsedDep> deps = new ArrayList<>();
        List<String> diagnostics = new ArrayList<>();
        boolean isDevFile = filePath.toLowerCase().contains("dev") || filePath.toLowerCase().contains("test");

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                // Skip empty lines and full line comments
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                // Skip flags like -r, -i, --index-url, -f
                if (line.startsWith("-")) {
                    continue;
                }

                // Remove inline comments
                int commentIdx = line.indexOf('#');
                if (commentIdx != -1) {
                    line = line.substring(0, commentIdx).trim();
                }

                // Remove environment markers: ; python_version >= '3.8'
                int markerIdx = line.indexOf(';');
                if (markerIdx != -1) {
                    line = line.substring(0, markerIdx).trim();
                }

                if (line.isEmpty()) continue;

                Matcher matcher = DEP_PATTERN.matcher(line);
                if (matcher.matches()) {
                    String pkgName = matcher.group(1).trim();
                    String operator = matcher.group(2);
                    String version = matcher.group(3);

                    String resolvedVersion = (version != null && !version.isBlank()) ? version.trim() : "LATEST";

                    deps.add(ParsedDep.builder()
                            .groupId("pypi")
                            .artifactId(pkgName)
                            .version(resolvedVersion)
                            .scope(isDevFile ? "dev" : "runtime")
                            .isDev(isDevFile)
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
            log.warn("Failed to parse python requirements file at {}: {}", filePath, e.getMessage());
            return ManifestParseResult.failure(filePath, getEcosystem(), "Failed to parse requirements.txt: " + e.getMessage());
        }
    }
}

