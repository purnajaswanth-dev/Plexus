package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvidenceRefDTO {
    private String type; // STATIC, RUNTIME, INFERRED
    private String file; // full repo-relative filePath
    private Integer startLine;
    private Integer endLine;
    private String snippetRef;
    private String description;
}
