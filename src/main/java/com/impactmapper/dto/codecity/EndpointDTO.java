package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EndpointDTO {
    private Long id;
    private String httpMethod;
    private String routePath;
    private String controllerClass;
    private String handlerMethod;
    private String parametersJson;
    private String requestBodyType;
    private String responseType;
    private String sourceFile;
    private Integer startLine;
    private Integer endLine;
    private String nodeKey;
    private Integer estimatedSteps;
    private String apiCategory;
    private String authClassification;
    private String analysisStatus;
    private String journeyStatus;
    @Builder.Default
    private java.util.List<String> stages = new java.util.ArrayList<>();
}

