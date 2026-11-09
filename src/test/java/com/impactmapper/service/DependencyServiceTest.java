package com.impactmapper.service;

import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DependencyServiceTest {

    @Mock
    private RepoDependencyRepository dependencyRepository;

    @Mock
    private RepositoryRepository repositoryRepository;

    @InjectMocks
    private DependencyService dependencyService;

    private Repository repo1;
    private Repository repo2;
    private RepoDependency dep1;
    private RepoDependency dep2;

    @BeforeEach
    void setUp() {
        repo1 = Repository.builder()
                .id(1L)
                .repoName("org/alpha-service")
                .repoUrl("https://github.com/org/alpha-service")
                .lastIndexed(LocalDateTime.now())
                .build();

        repo2 = Repository.builder()
                .id(2L)
                .repoName("org/beta-service")
                .repoUrl("https://github.com/org/beta-service")
                .lastIndexed(LocalDateTime.now())
                .build();

        dep1 = RepoDependency.builder()
                .id(101L)
                .repository(repo1)
                .groupId("org.springframework.boot")
                .artifactId("spring-boot-starter-web")
                .version("3.2.5")
                .scope("compile")
                .packageType("MAVEN")
                .isDev(false)
                .build();

        dep2 = RepoDependency.builder()
                .id(102L)
                .repository(repo2)
                .groupId("org.springframework.boot")
                .artifactId("spring-boot-starter-web")
                .version("3.2.4")
                .scope("compile")
                .packageType("MAVEN")
                .isDev(false)
                .build();
    }

    @Test
    void testGetLibraries_AggregatesVersionsAndRepositories() {
        when(dependencyRepository.findAllWithRepository()).thenReturn(List.of(dep1, dep2));

        List<DependencyService.LibrarySummary> summaries = dependencyService.getLibraries(null, null, null, null);

        assertNotNull(summaries);
        assertEquals(1, summaries.size());
        DependencyService.LibrarySummary summary = summaries.get(0);
        assertEquals("spring-boot-starter-web", summary.getArtifactId());
        assertEquals("org.springframework.boot", summary.getGroupId());
        assertEquals(2, summary.getRepoCount());
        assertEquals(2, summary.getVersionCount());
        assertFalse(summary.isConsistent()); // Versions 3.2.4 and 3.2.5 diverge
        assertEquals(2, summary.getRepositories().size());
    }

    @Test
    void testGetLibraries_FilterByConsistency() {
        when(dependencyRepository.findAllWithRepository()).thenReturn(List.of(dep1, dep2));

        List<DependencyService.LibrarySummary> consistentOnly = dependencyService.getLibraries(null, null, "consistent", null);
        assertTrue(consistentOnly.isEmpty());

        List<DependencyService.LibrarySummary> divergentOnly = dependencyService.getLibraries(null, null, "divergent", null);
        assertEquals(1, divergentOnly.size());
    }

    @Test
    void testGetLibraries_FilterByRepoId() {
        when(dependencyRepository.findAllWithRepository()).thenReturn(List.of(dep1, dep2));

        List<DependencyService.LibrarySummary> repo1Only = dependencyService.getLibraries(null, null, null, 1L);
        assertEquals(1, repo1Only.size());
        assertEquals(1, repo1Only.get(0).getRepoCount());
        assertTrue(repo1Only.get(0).isConsistent());
    }

    @Test
    void testGetLibraryDetail() {
        when(dependencyRepository.findByArtifactIdAndGroupId("spring-boot-starter-web", "org.springframework.boot"))
                .thenReturn(List.of(dep1, dep2));

        Map<String, Object> detail = dependencyService.getLibraryDetail("spring-boot-starter-web", "org.springframework.boot", "MAVEN");

        assertNotNull(detail);
        assertEquals("org.springframework.boot:spring-boot-starter-web", detail.get("displayName"));
        assertEquals(2, detail.get("repoCount"));
        assertEquals(2, detail.get("versionCount"));
        assertFalse((Boolean) detail.get("isConsistent"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> usages = (List<Map<String, Object>>) detail.get("usages");
        assertEquals(2, usages.size());
        assertEquals("org/alpha-service", usages.get(0).get("repoName"));
    }
}
