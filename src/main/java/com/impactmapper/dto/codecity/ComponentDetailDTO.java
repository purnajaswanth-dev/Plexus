package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComponentDetailDTO {
    private String nodeKey;
    private String name;
    private String qualifiedName;
    private String componentType;
    private String packageName;
    private String districtName;
    private String filePath;
    private Integer startLine;
    private Integer endLine;
    private Integer lineCount;
    @Builder.Default
    private List<String> annotations = new ArrayList<>();
    @Builder.Default
    private List<MethodDetailDTO> methods = new ArrayList<>();
    @Builder.Default
    private List<String> fields = new ArrayList<>();
    @Builder.Default
    private List<RelatedComponentDTO> callers = new ArrayList<>();
    @Builder.Default
    private List<RelatedComponentDTO> callees = new ArrayList<>();
    @Builder.Default
    private List<RelatedComponentDTO> dependencies = new ArrayList<>();
    @Builder.Default
    private List<EndpointDTO> associatedEndpoints = new ArrayList<>();
    private String sourceSnippet;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MethodDetailDTO {
        private String name;
        private String signature;
        private Integer startLine;
        private Integer endLine;
        private String returnType;
        @Builder.Default
        private List<String> parameters = new ArrayList<>();
        @Builder.Default
        private List<String> callers = new ArrayList<>();
        @Builder.Default
        private List<String> callees = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RelatedComponentDTO {
        private String nodeKey;
        private String name;
        private String type;
        private String relationshipType;
        private String evidence;
    }
}

