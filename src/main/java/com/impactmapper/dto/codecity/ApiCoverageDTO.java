package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiCoverageDTO {
    private Long repositoryId;
    private String repositoryName;
    private Long snapshotId;
    private String commitSha;

    private Integer totalExposedApis;
    private Integer resolvedEntryPoints;
    private Integer completeJourneys;
    private Integer partialJourneys;
    private Integer unresolvedSegments;
    private Integer unsupportedApis;
    private Integer runtimeObservedJourneys;
    private Double coveragePercentage;

    @Builder.Default
    private Map<String, Integer> categoryBreakdown = new HashMap<>();

    @Builder.Default
    private Map<String, Integer> authBreakdown = new HashMap<>();

    @Builder.Default
    private Map<String, Integer> methodBreakdown = new HashMap<>();
}

