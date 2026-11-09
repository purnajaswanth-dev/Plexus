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
public class JourneyNodeDTO {
    private String id;
    private String kind; // ENDPOINT_GATE, METHOD, CONSTRUCTOR, FRAMEWORK_OPERATION, DB_OPERATION, EXTERNAL_CALL, EVENT_PUBLICATION, EVENT_CONSUMPTION, UNRESOLVED
    private String name;
    private String methodId;
    private String typeId;
    private String fileId; // Full repository-relative filePath
    private CityRefDTO cityRef;
    private String resolution; // RESOLVED, PARTIAL, UNRESOLVED
    @Builder.Default
    private List<EvidenceRefDTO> evidence = new ArrayList<>();

    // Inspector metadata
    private String signature;
    private String returnType;
    @Builder.Default
    private List<String> parameterTypes = new ArrayList<>();
    private String explanation;
}

