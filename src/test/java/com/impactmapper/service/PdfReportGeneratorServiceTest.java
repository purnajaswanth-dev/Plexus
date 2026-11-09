package com.impactmapper.service;

import com.impactmapper.dto.ImpactAnalysisResult;
import com.impactmapper.dto.ImpactedRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

class PdfReportGeneratorServiceTest {

    private PdfReportGeneratorService pdfReportGeneratorService;

    @BeforeEach
    void setUp() {
        pdfReportGeneratorService = new PdfReportGeneratorService();
    }

    @Test
    void testGenerateImpactReportPdf() {
        ImpactedRepo repoA = ImpactedRepo.builder()
                .repoId(1L)
                .repoName("org/payment-service")
                .repoUrl("https://github.com/org/payment-service")
                .currentVersion("2.7.18")
                .targetVersion("3.2.5")
                .impactLevel("BREAKING")
                .reason("Major version upgrade from 2.7.18 to 3.2.5 - breaking API changes expected")
                .recommendedAction("Audit breaking changes and run integration test suite")
                .dependencyScope("compile")
                .build();

        ImpactedRepo repoB = ImpactedRepo.builder()
                .repoId(2L)
                .repoName("org/notification-service")
                .repoUrl("https://github.com/org/notification-service")
                .currentVersion("3.2.4")
                .targetVersion("3.2.5")
                .impactLevel("SAFE")
                .reason("Minor patch update - backward compatible")
                .recommendedAction("Proceed with standard CI build verification")
                .dependencyScope("compile")
                .build();

        ImpactAnalysisResult result = ImpactAnalysisResult.builder()
                .libraryName("org.springframework.boot:spring-boot-starter-web")
                .fromVersion("2.7.18")
                .toVersion("3.2.5")
                .totalAffectedRepos(2)
                .breakingCount(1)
                .warningCount(0)
                .safeCount(1)
                .breakingRepos(Arrays.asList(repoA))
                .warningRepos(Arrays.asList())
                .safeRepos(Arrays.asList(repoB))
                .allImpactedRepos(Arrays.asList(repoA, repoB))
                .overallRecommendation("INVESTIGATE BEFORE UPGRADING")
                .recommendationReason("Identified 1 repository undergoing major version transition.")
                .executiveSummary("Evaluation of upgrading spring-boot-starter-web to 3.2.5 across 2 repositories.")
                .versionDifference("MAJOR")
                .analysisTime(LocalDateTime.now())
                .methodology("SemVer heuristic risk assessment")
                .build();

        byte[] pdfBytes = pdfReportGeneratorService.generateImpactReportPdf(result);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 500, "PDF byte stream should contain rendered pages");

        // Verify PDF Magic Bytes (%PDF-)
        String header = new String(Arrays.copyOfRange(pdfBytes, 0, 5));
        assertEquals("%PDF-", header, "Should start with valid PDF magic bytes %PDF-");
    }
}

