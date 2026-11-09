package com.impactmapper.service;

import com.impactmapper.dto.ImpactAnalysisResult;
import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.RepoDependencyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class ImpactAnalysisServiceTest {

    private RepoDependencyRepository dependencyRepository;
    private ImpactAnalysisService impactAnalysisService;

    @BeforeEach
    void setUp() {
        dependencyRepository = Mockito.mock(RepoDependencyRepository.class);
        impactAnalysisService = new ImpactAnalysisService(dependencyRepository);
    }

    @Test
    void testVersionParsingAndComparison() {
        ImpactAnalysisService.Version v1 = impactAnalysisService.parseVersion("v1.2.3");
        assertEquals(1, v1.major);
        assertEquals(2, v1.minor);
        assertEquals(3, v1.patch);

        ImpactAnalysisService.Version v2 = impactAnalysisService.parseVersion("^2.0.0-beta");
        assertEquals(2, v2.major);
        assertEquals(0, v2.minor);
        assertEquals(0, v2.patch);

        assertTrue(impactAnalysisService.isOlder(v1, v2));
        assertFalse(impactAnalysisService.isOlder(v2, v1));
    }

    @Test
    void testAnalyzeImpactBreakingAndSafe() {
        Repository repoA = Repository.builder().id(1L).repoName("org/repo-a").repoUrl("https://github.com/org/repo-a").build();
        Repository repoB = Repository.builder().id(2L).repoName("org/repo-b").repoUrl("https://github.com/org/repo-b").build();

        RepoDependency depA = RepoDependency.builder()
                .repository(repoA)
                .groupId("org.springframework")
                .artifactId("spring-web")
                .version("5.3.20")
                .scope("compile")
                .packageType("MAVEN")
                .build();

        RepoDependency depB = RepoDependency.builder()
                .repository(repoB)
                .groupId("org.springframework")
                .artifactId("spring-web")
                .version("6.0.0")
                .scope("compile")
                .packageType("MAVEN")
                .build();

        when(dependencyRepository.findByArtifactIdAndGroupId("spring-web", "org.springframework"))
                .thenReturn(Arrays.asList(depA, depB));

        // Upgrade from 5.3.0 to 6.0.0 (Major upgrade -> breaking for repoA, safe/current for repoB)
        ImpactAnalysisResult result = impactAnalysisService.analyzeImpact("org.springframework", "spring-web", "5.3.0", "6.0.0");

        assertNotNull(result);
        assertEquals(2, result.getTotalAffectedRepos());
        assertEquals(1, result.getBreakingCount());
        assertEquals("BREAKING", result.getBreakingRepos().get(0).getImpactLevel());
        assertEquals("org/repo-a", result.getBreakingRepos().get(0).getRepoName());
        assertNotNull(result.getMethodology());
    }

    @Test
    void testValidation() {
        assertThrows(IllegalArgumentException.class, () -> {
            impactAnalysisService.analyzeImpact("group", "", "1.0.0", "2.0.0");
        });

        assertThrows(IllegalArgumentException.class, () -> {
            impactAnalysisService.analyzeImpact("group", "artifact", "1.0.0", null);
        });
    }
}

