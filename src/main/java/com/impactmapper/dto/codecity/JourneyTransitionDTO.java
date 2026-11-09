package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JourneyTransitionDTO {
    private String id;
    private String fromNodeId;
    private String toNodeId;
    private String kind; // CALL, RETURN, EXCEPTION, EVENT_PUBLISH, EVENT_CONSUME, DB_ACCESS, EXTERNAL_CALL
    private String sync; // SYNC, ASYNC, UNKNOWN
    private String scope; // WORKSTATION, ROOM, BUILDING, EXTERNAL
    private String branchGroupId;
    private String branchLabel;
    private String roadId; // Only when scope is BUILDING or EXTERNAL
    private EvidenceRefDTO evidence;
    private String resolution; // RESOLVED, PARTIAL, UNRESOLVED

    // Explanation fields for Inspector
    private String whatIsHappening;
    private String whyInvolved;
    private String inputDetails;
    private String processingDetails;
    private String outputDetails;
    private String callExpression;
    private Integer orderIndex;
}

