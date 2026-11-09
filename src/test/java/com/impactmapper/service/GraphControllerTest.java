package com.impactmapper.service;

import com.impactmapper.controller.GraphController;
import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GraphControllerTest {

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private RepoDependencyRepository dependencyRepository;

    @Mock
    private HealthService healthService;

    @InjectMocks
    private GraphController graphController;

    private Repository repo1;
    private Repository repo2;
    private List<RepoDependency> allDeps;

    @BeforeEach
    void setUp() {
        repo1 = Repository.builder().id(1L).repoName("repo-1").dependencyFileType("MAVEN").build();
        repo2 = Repository.builder().id(2L).repoName("repo-2").dependencyFileType("MAVEN").build();

        RepoDependency d1 = RepoDependency.builder()
                .id(1L).repository(repo1).packageType("MAVEN").groupId("org.slf4j").artifactId("slf4j-api").version("2.0.0").build();
        RepoDependency d2 = RepoDependency.builder()
                .id(2L).repository(repo2).packageType("MAVEN").groupId("org.slf4j").artifactId("slf4j-api").version("1.7.30").build();
        RepoDependency d3 = RepoDependency.builder()
                .id(3L).repository(repo1).packageType("MAVEN").groupId("junit").artifactId("junit").version("4.13").build();

        allDeps = List.of(d1, d2, d3);

        HealthService.HealthReport mockHealth = new HealthService.HealthReport(90, "Healthy", Collections.emptyList());
        when(healthService.evaluateHealth(any(), any())).thenReturn(mockHealth);
    }

    @Test
    @DisplayName("Repository relationship graph correctly connects repos sharing dependencies")
    void testRepositoryRelationshipGraph() {
        when(repositoryRepository.findAll()).thenReturn(List.of(repo1, repo2));
        when(dependencyRepository.findAll()).thenReturn(allDeps);

        Map<String, Object> result = graphController.getRepositoryGraph();

        assertNotNull(result);
        assertEquals("REPOSITORY_SIMILARITY", result.get("mode"));
        assertEquals(2, result.get("totalNodes"));
        assertEquals(1, result.get("totalEdges"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> edges = (List<Map<String, Object>>) result.get("edges");
        assertEquals(1, edges.size());

        Map<String, Object> edge = edges.get(0);
        assertEquals(1L, edge.get("source"));
        assertEquals(2L, edge.get("target"));
        assertEquals(1, edge.get("weight")); // 1 shared library (slf4j-api)
        assertEquals(50, edge.get("similarityPercentage")); // 1 shared / 2 union = 50%
    }

    @Test
    @DisplayName("Bipartite graph flags divergent versions across repositories")
    void testBipartiteGraphDivergenceDetection() {
        when(repositoryRepository.findAll()).thenReturn(List.of(repo1, repo2));
        when(dependencyRepository.findAll()).thenReturn(allDeps);

        Map<String, Object> result = graphController.getBipartiteGraph();

        assertNotNull(result);
        assertEquals("BIPARTITE_ECOSYSTEM", result.get("mode"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) result.get("nodes");

        // Find slf4j-api node
        Optional<Map<String, Object>> slf4jNode = nodes.stream()
                .filter(n -> "slf4j-api".equals(n.get("artifactId")))
                .findFirst();

        assertTrue(slf4jNode.isPresent());
        Map<String, Object> dep = slf4jNode.get();
        assertEquals("DEPENDENCY", dep.get("nodeCategory"));
        assertEquals(2, dep.get("versionCount")); // 2.0.0 and 1.7.30
        assertEquals(true, dep.get("isDivergent")); // Divergent versions
        assertEquals(2, dep.get("repoCount")); // Used in both repos
    }
}
