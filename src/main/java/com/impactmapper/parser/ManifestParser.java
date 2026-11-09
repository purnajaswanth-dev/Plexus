package com.impactmapper.parser;

public interface ManifestParser {
    /**
     * Determines whether this parser supports the given manifest file path.
     * e.g. "backend/pom.xml", "build.gradle", "frontend/package.json"
     */
    boolean supports(String filePath);

    /**
     * Returns the ecosystem identifier (e.g. MAVEN, GRADLE, NPM, PYTHON, GO).
     */
    String getEcosystem();

    /**
     * Parses the manifest file content into structured dependencies.
     */
    ManifestParseResult parse(String filePath, String content);
}

