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
public class PlaybackStateDTO {
    private String journeyId;
    private String mode; // STATIC | RUNTIME
    private String cursorNodeId;
    private String cursorTransitionId;
    private String phase; // CALL | RETURN | EXCEPTION
    @Builder.Default
    private Map<String, String> branchSelections = new HashMap<>();
    private String requestOrResponse; // REQUEST | RESPONSE
    private boolean playing;
    private Double speed;
}

