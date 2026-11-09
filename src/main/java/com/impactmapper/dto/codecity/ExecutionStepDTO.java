package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionStepDTO {
    private Integer stepIndex;
    private String sourceComponentKey;
    private String sourceComponentName;
    private String targetComponentKey;
    private String targetComponentName;
    private String sourceMethod;
    private String targetMethod;
    private String callExpression;
    private Integer sourceLineNumber;
    private String relationshipType;
    private String branchCondition;
    private String evidence;
    private Boolean isResolved;

    // Deep Step Explanation Details
    private String fileName;
    private String folderPath;
    private String whatIsHappening;
    private String whyInvolved;
    private String inputDetails;
    private String processingDetails;
    private String outputDetails;
    private String sourceEvidence;
    private String sourceCodeSnippet;
    private String nextStepDetails;
    private String confidence;
    private String branchInfo;
}

