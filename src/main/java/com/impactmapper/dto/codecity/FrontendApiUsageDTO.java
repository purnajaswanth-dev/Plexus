package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FrontendApiUsageDTO {
    private String frontendFile;
    private Integer lineNumber;
    private String httpMethod;
    private String requestedPath;
    private String callExpression;
    private Boolean isResolved;
    private Long matchedEndpointId;
    private String matchedController;
    private String matchedHandlerMethod;
    private String unresolvedReason;
}

