package com.impactmapper.service;

import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

class HealthServiceTest {

    private HealthService healthService;

    @BeforeEach
    void setUp() {
        healthService = new HealthService();
    }

    // Scenario 14: Health score calculation for repositories without manifests (must NOT be 25/100 Critical)
    @Test
    void testScenario14_RepoWithoutManifestMustNotBePenalizedAsCritical() {
        Repository repo = Repository.builder()
                .id(1L)
                .repoName("developer/documentation-repo")
                .indexStatus("INDEXED_NO_MANIFEST")
                .dependencyFileType("NONE")
                .language("Markdown")
                .totalFilesDiscovered(45)
                .build();

        HealthService.HealthReport report = healthService.evaluateHealth(repo, Collections.emptyList());

        // Must NOT be 25/100 Critical
        assertNotEquals("Critical", report.getRating());
        assertNotEquals(25, report.getScore());
        assertTrue(report.getScore() >= 70, "Repositories without manifests should receive a healthy/provisional score");
        assertEquals("Healthy", report.getRating());
        assertTrue(report.getIssues().stream().anyMatch(i -> i.contains("No external dependency manifests")));
    }

    @Test
    void testTrulyFailedRepoHasCriticalHealth() {
        Repository repo = Repository.builder()
                .id(2L)
                .repoName("test/failed-repo")
                .indexStatus("FAILED")
                .statusDetail("Inaccessible repository: 404")
                .build();

        HealthService.HealthReport report = healthService.evaluateHealth(repo, Collections.emptyList());
        assertEquals("Critical", report.getRating());
        assertEquals(25, report.getScore());
        assertTrue(report.getIssues().contains("Inaccessible repository: 404"));
    }

    @Test
    void testHealthyRepoWithCleanDependencies() {
        Repository repo = Repository.builder()
                .id(3L)
                .repoName("test/clean-repo")
                .indexStatus("INDEXED")
                .dependencyFileType("MAVEN")
                .build();

        RepoDependency d1 = RepoDependency.builder().artifactId("lib-a").version("1.0.0").build();
        RepoDependency d2 = RepoDependency.builder().artifactId("lib-b").version("2.1.0").build();

        HealthService.HealthReport report = healthService.evaluateHealth(repo, Arrays.asList(d1, d2));
        assertEquals("Healthy", report.getRating());
        assertEquals(100, report.getScore());
    }

    @Test
    void testRepoWithUnresolvedVersionsDeduction() {
        Repository repo = Repository.builder()
                .id(4L)
                .repoName("test/unresolved-repo")
                .indexStatus("INDEXED")
                .dependencyFileType("MAVEN")
                .build();

        RepoDependency d1 = RepoDependency.builder().artifactId("lib-a").version("RESOLVED_AT_BUILD_TIME").build();
        RepoDependency d2 = RepoDependency.builder().artifactId("lib-b").version("1.0.0").build();

        HealthService.HealthReport report = healthService.evaluateHealth(repo, Arrays.asList(d1, d2));
        assertTrue(report.getScore() < 100);
        assertTrue(report.getIssues().stream().anyMatch(i -> i.contains("unresolved versions")));
    }
}
