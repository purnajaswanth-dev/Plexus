package com.impactmapper.dto;

import lombok.*;
import java.util.List;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImpactAnalysisResult {
    private String libraryName;
    private String fromVersion;
    private String toVersion;
    private long totalAffectedRepos;
    private int breakingCount;
    private int warningCount;
    private int safeCount;
    private List<ImpactedRepo> breakingRepos;
    private List<ImpactedRepo> warningRepos;
    private List<ImpactedRepo> safeRepos;
    private List<ImpactedRepo> allImpactedRepos;
    private List<ImpactFinding> findings;
    private LocalDateTime analysisTime;
    private String methodology;

    // Structured Assessment Outcomes
    private String overallRecommendation; // PROCEED, PROCEED WITH CAUTION, INVESTIGATE BEFORE UPGRADING
    private String recommendationReason;
    private String executiveSummary;
    private String versionDifference; // MAJOR, MINOR, PATCH, SAME
}
