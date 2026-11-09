package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuntimeTraceDTO {
    private String traceId;
    private Long repositoryId;
    private String commitSha;
    private String endpointRoute;
    private String httpMethod;
    private Integer statusCode;
    private Long durationMs;
    private String serviceName;
    private LocalDateTime recordedAt;
    private String environment;
    @Builder.Default
    private List<RuntimeSpanDTO> spans = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuntimeSpanDTO {
        private String spanId;
        private String parentSpanId;
        private String componentKey;
        private String componentName;
        private String operationName;
        private Long durationMs;
        private Long startOffsetMs;
        private Boolean hasError;
        private String errorMessage;
        private String attributesJson;
    }
}

