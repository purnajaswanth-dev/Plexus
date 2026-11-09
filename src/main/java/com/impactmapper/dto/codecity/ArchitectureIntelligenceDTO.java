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
public class ArchitectureIntelligenceDTO {

    private Long repositoryId;
    private String repositoryName;
    private Long snapshotId;
    private String commitSha;

    // 5.1 Architecture Overview Metrics
    private Integer totalAnalyzedFiles;
    private Integer totalDeclarations;
    private Integer totalMethods;
    private Integer totalDistricts;
    private Integer totalDependencies;
    private Integer resolvedRelationships;
    private Integer unresolvedRelationships;
    private Integer unsupportedFiles;
    private Double analysisCoverage;
    private Integer runtimeInstrumentedComponents;

    // 5.2 Architectural Hotspots
    @Builder.Default
    private List<HotspotDTO> hotspots = new ArrayList<>();

    // 5.3 & 5.4 Circular Dependencies
    @Builder.Default
    private List<CycleDTO> circularDependencies = new ArrayList<>();

    // 5.3 Coupling & Dependency Metrics
    @Builder.Default
    private List<CouplingMetricDTO> districtCoupling = new ArrayList<>();

    // 5.7 Architecture Warnings
    @Builder.Default
    private List<ArchitectureWarningDTO> warnings = new ArrayList<>();

    // 5.8 Test Intelligence
    private TestIntelligenceDTO testIntelligence;

    // 5.9 Runtime Performance Summary
    private RuntimePerformanceSummaryDTO runtimePerformance;

    // 5.6 Snapshot History Comparison
    private SnapshotDeltaDTO snapshotDelta;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HotspotDTO {
        private String nodeKey;
        private String name;
        private String filePath;
        private String componentType;
        private Double score;
        private Integer fanIn;
        private Integer fanOut;
        private Integer lineCount;
        @Builder.Default
        private List<String> reasons = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CycleDTO {
        private String cycleId;
        private Integer length;
        @Builder.Default
        private List<String> cyclePath = new ArrayList<>();
        @Builder.Default
        private List<String> participatingNodeKeys = new ArrayList<>();
        @Builder.Default
        private List<CycleEdgeDTO> participatingEdges = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CycleEdgeDTO {
        private String sourceKey;
        private String targetKey;
        private String relationshipType;
        private String evidence;
        private String evidenceLevel;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CouplingMetricDTO {
        private String districtName;
        private Integer componentCount;
        private Integer internalCalls;
        private Integer afferentCoupling; // Inbound dependencies (Ca)
        private Integer efferentCoupling; // Outbound dependencies (Ce)
        private Double instability;       // Ce / (Ca + Ce)
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ArchitectureWarningDTO {
        private String id;
        private String severity; // CRITICAL, WARNING, INFO
        private String category; // CIRCULAR_DEPENDENCY, HIGH_COUPLING, UNRESOLVED_DEPENDENCY, UNSUPPORTED_FILE
        private String entityKey;
        private String entityName;
        private String message;
        private String evidence;
        private String suggestedAction;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestIntelligenceDTO {
        private Integer testFilesCount;
        private Integer testedComponentsCount;
        private Integer untestedComponentsCount;
        @Builder.Default
        private List<TestMappingDTO> testMappings = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestMappingDTO {
        private String testFileName;
        private String testFilePath;
        private String targetComponentName;
        private String targetComponentKey;
        private String relationshipType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RuntimePerformanceSummaryDTO {
        private Boolean telemetryAvailable;
        private Integer totalTraces;
        private Double averageDurationMs;
        private Integer errorCount;
        @Builder.Default
        private List<SlowSpanDTO> slowestSpans = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SlowSpanDTO {
        private String traceId;
        private String componentName;
        private String operationName;
        private Long durationMs;
        private Boolean hasError;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SnapshotDeltaDTO {
        private Boolean hasMultipleSnapshots;
        private String message;
        private Long baselineSnapshotId;
        private Long currentSnapshotId;
        private Integer addedFilesCount;
        private Integer removedFilesCount;
        private Integer addedRelationshipsCount;
        private Integer removedRelationshipsCount;
        @Builder.Default
        private List<String> addedFiles = new ArrayList<>();
        @Builder.Default
        private List<String> removedFiles = new ArrayList<>();
    }
}

