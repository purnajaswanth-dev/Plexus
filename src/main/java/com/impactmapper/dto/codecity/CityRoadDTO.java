package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityRoadDTO {
    private String id;
    private String sourceBuildingId;
    private String targetBuildingId;
    private String sourceRoomId;
    private String targetRoomId;
    private String relationshipType; // CALLS, PERSISTS_TO, EXTERNAL_CALL, EVENT_ASYNC, EXTENDS, IMPLEMENTS, DEPENDS_ON, RUNTIME_TRACE
    private String roadType; // HIGHWAY (calls), ARTERIAL (persists), LOCAL (depends)
    private String evidence;
    private String evidenceLevel; // DIRECTLY_DETECTED, STATIC_INFERENCE
    private Boolean isExecutionPath;

    // Visual road representation
    private String roadName;
    private Integer laneCount;
    private String color;
    private Boolean dashed;
}

