package com.impactmapper.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImpactFinding {
    private String title;
    private String category; // MAJOR_VERSION_TRANSITION, DEPRECATION_GAP, SCOPE_CONTAINMENT, VERSION_ALIGNMENT
    private String affectedRepo;
    private String currentValue;
    private String targetValue;
    private String exactEvidence;
    private String sourceLocation;
    private String explanation;
    private String riskImplication;
    private String recommendedAction;

    // LEVEL_1_DIRECTLY_DETECTED, LEVEL_2_VERSION_BASED_INFERENCE, LEVEL_3_VERIFIED_COMPATIBILITY
    private String evidenceLevel;
}

