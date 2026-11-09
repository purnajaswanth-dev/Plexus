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
public class BranchGroupDTO {
    private String id;
    private String atNodeId;
    private String conditionText;
    @Builder.Default
    private List<BranchOutcomeDTO> outcomes = new ArrayList<>();
    private boolean outcomeKnown;
}

