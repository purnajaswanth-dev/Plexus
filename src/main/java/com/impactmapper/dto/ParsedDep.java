package com.impactmapper.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ParsedDep {
    private String groupId;
    private String artifactId;
    private String version;
    private String scope;
    private boolean isDev;
    private String packageType; // MAVEN, NPM, GRADLE, PYTHON, GO, etc.
    private String manifestPath; // e.g. "backend/pom.xml", "frontend/package.json"
}
