package com.impactmapper.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImpactedRepo {
    private Long repoId;
    private String repoName;
    private String repoUrl;
    private String currentVersion;
    private String targetVersion;
    private String impactLevel; // BREAKING, WARNING, SAFE
    private String reason;
    private String recommendedAction;
    private String dependencyScope;
}
