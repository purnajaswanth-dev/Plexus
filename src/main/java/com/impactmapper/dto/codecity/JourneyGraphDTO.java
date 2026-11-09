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
public class JourneyGraphDTO {
    private String journeyId;
    private Long snapshotId;
    private Long endpointId;
    private String mode; // STATIC | RUNTIME
    private String entryNodeId;
    @Builder.Default
    private List<JourneyNodeDTO> nodes = new ArrayList<>();
    @Builder.Default
    private List<JourneyTransitionDTO> transitions = new ArrayList<>();
    @Builder.Default
    private List<BranchGroupDTO> branchGroups = new ArrayList<>();
    @Builder.Default
    private List<JourneyGraphDTO> asyncFlows = new ArrayList<>();
    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    // Summary metadata
    private String httpMethod;
    private String routePath;
    private String controllerClass;
    private String handlerMethod;
    private Integer totalSteps;
    private String inferredSummary;
    private boolean hasAlternativeBranches;
}

