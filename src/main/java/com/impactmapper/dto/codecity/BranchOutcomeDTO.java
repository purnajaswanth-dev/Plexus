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
public class BranchOutcomeDTO {
    private String id;
    private String label; // e.g. "if (invalid)" or "else (valid)"
    @Builder.Default
    private List<String> transitionIds = new ArrayList<>();
    private String targetNodeId;
    private String description;
}

