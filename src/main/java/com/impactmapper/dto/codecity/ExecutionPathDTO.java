package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionPathDTO {
    private Long id;
    private Long endpointId;
    private String httpMethod;
    private String routePath;
    private Integer totalSteps;
    private String inferredSummary;
    private Boolean hasAlternativeBranches;
    @Builder.Default
    private List<String> involvedBuildingKeys = new ArrayList<>();
    @Builder.Default
    private List<ExecutionStepDTO> steps = new ArrayList<>();
    @Builder.Default
    private List<ExecutionStepDTO> responseSteps = new ArrayList<>();
}

