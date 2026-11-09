package com.impactmapper.service;

import com.impactmapper.entity.ArchitectureEdge;
import com.impactmapper.entity.ArchitectureNode;
import com.impactmapper.entity.ArchitectureSnapshot;
import com.impactmapper.entity.Repository;
import com.impactmapper.repository.ArchitectureEdgeRepository;
import com.impactmapper.repository.ArchitectureNodeRepository;
import com.impactmapper.repository.ArchitectureSnapshotRepository;
import com.impactmapper.repository.RepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ArchitectureIsolationTest {

    @Mock
    private ArchitectureSnapshotRepository snapshotRepository;

    @Mock
    private ArchitectureNodeRepository nodeRepository;

    @Mock
    private ArchitectureEdgeRepository edgeRepository;

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private GitHubService gitHubService;

    @Mock
    private JavaSourceAnalysisService javaAnalysisService;

    @Mock
    private JavaScriptSourceAnalysisService jsAnalysisService;

    @InjectMocks
    private ArchitectureAnalysisService architectureAnalysisService;

    private Repository repoA;
    private Repository repoB;
    private ArchitectureSnapshot snapshotA;
    private ArchitectureSnapshot snapshotB;

    @BeforeEach
    void setUp() {
        repoA = Repository.builder().id(101L).repoName("org/repo-a").dependencyFileType("MAVEN").build();
        repoB = Repository.builder().id(102L).repoName("org/repo-b").dependencyFileType("NPM").build();

        snapshotA = ArchitectureSnapshot.builder()
                .id(1L)
                .repository(repoA)
                .commitSha("sha-a123")
                .status("ANALYZED")
                .analyzedAt(LocalDateTime.now())
                .totalFilesAnalyzed(15)
                .totalComponents(10)
                .totalRelationships(20)
                .analysisSummary("Repo A analyzed")
                .build();

        snapshotB = ArchitectureSnapshot.builder()
                .id(2L)
                .repository(repoB)
                .commitSha("sha-b456")
                .status("ANALYZED")
                .analyzedAt(LocalDateTime.now())
                .totalFilesAnalyzed(8)
                .totalComponents(6)
                .totalRelationships(12)
                .analysisSummary("Repo B analyzed")
                .build();
    }

    @Test
    @DisplayName("Architecture graph must strictly isolate data by repository ID")
    void testArchitectureGraphRepositoryIsolation() {
        // Arrange
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(snapshotA));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(102L)).thenReturn(Optional.of(snapshotB));

        ArchitectureNode nodeA = ArchitectureNode.builder().id(1L).nodeKey("repo:org/repo-a").name("repo-a").level(1).build();
        ArchitectureNode nodeB = ArchitectureNode.builder().id(2L).nodeKey("repo:org/repo-b").name("repo-b").level(1).build();

        when(nodeRepository.findBySnapshotIdAndLevelLessThanEqual(1L, 3)).thenReturn(List.of(nodeA));
        when(nodeRepository.findBySnapshotIdAndLevelLessThanEqual(2L, 3)).thenReturn(List.of(nodeB));
        when(edgeRepository.findBySnapshotId(1L)).thenReturn(Collections.emptyList());
        when(edgeRepository.findBySnapshotId(2L)).thenReturn(Collections.emptyList());

        // Act
        Map<String, Object> resultA = architectureAnalysisService.getArchitectureGraph(101L, 3);
        Map<String, Object> resultB = architectureAnalysisService.getArchitectureGraph(102L, 3);

        // Assert
        assertNotNull(resultA);
        assertEquals(1L, resultA.get("snapshotId"));
        assertEquals("sha-a123", resultA.get("commitSha"));
        List<?> nodesA = (List<?>) resultA.get("nodes");
        assertEquals(1, nodesA.size());
        assertEquals("repo-a", ((ArchitectureNode) nodesA.get(0)).getName());

        assertNotNull(resultB);
        assertEquals(2L, resultB.get("snapshotId"));
        assertEquals("sha-b456", resultB.get("commitSha"));
        List<?> nodesB = (List<?>) resultB.get("nodes");
        assertEquals(1, nodesB.size());
        assertEquals("repo-b", ((ArchitectureNode) nodesB.get(0)).getName());

        // Verify Repository A does not contain Repository B data
        assertNotEquals(resultA.get("commitSha"), resultB.get("commitSha"));
    }

    @Test
    @DisplayName("Edges in architecture graph must contain source and target properties matching node keys")
    void testArchitectureGraphEdgeSourceTargetMapping() {
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(snapshotA));

        ArchitectureNode rootNode = ArchitectureNode.builder().id(1L).nodeKey("repo:org/repo-a").name("repo-a").level(1).build();
        ArchitectureNode controllerNode = ArchitectureNode.builder().id(2L).nodeKey("class:org.test.UserController").name("UserController").level(2).build();

        when(nodeRepository.findBySnapshotIdAndLevelLessThanEqual(1L, 3)).thenReturn(List.of(rootNode, controllerNode));

        ArchitectureEdge edge = ArchitectureEdge.builder()
                .id(10L)
                .sourceNodeKey("repo:org/repo-a")
                .targetNodeKey("class:org.test.UserController")
                .relationshipType("CONTAINS")
                .evidence("Project structure")
                .build();

        when(edgeRepository.findBySnapshotId(1L)).thenReturn(List.of(edge));

        Map<String, Object> result = architectureAnalysisService.getArchitectureGraph(101L, 3);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> edges = (List<Map<String, Object>>) result.get("edges");
        assertNotNull(edges);
        assertEquals(1, edges.size());

        Map<String, Object> edgeMap = edges.get(0);
        assertEquals("repo:org/repo-a", edgeMap.get("source"));
        assertEquals("class:org.test.UserController", edgeMap.get("target"));
        assertEquals("CONTAINS", edgeMap.get("relationshipType"));
    }

    @Test
    @DisplayName("Unanalyzed repository returns NOT_ANALYZED with empty nodes and edges")
    void testUnanalyzedRepositoryReturnsNotAnalyzed() {
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(999L)).thenReturn(Optional.empty());

        Map<String, Object> result = architectureAnalysisService.getArchitectureGraph(999L, 3);

        assertNotNull(result);
        assertEquals("NOT_ANALYZED", result.get("status"));
        assertTrue(((List<?>) result.get("nodes")).isEmpty());
        assertTrue(((List<?>) result.get("edges")).isEmpty());
    }
}

