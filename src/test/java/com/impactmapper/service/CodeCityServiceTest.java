package com.impactmapper.service;

import com.impactmapper.dto.codecity.*;
import com.impactmapper.entity.*;
import com.impactmapper.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CodeCityServiceTest {

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private ArchitectureSnapshotRepository snapshotRepository;

    @Mock
    private ArchitectureNodeRepository nodeRepository;

    @Mock
    private ArchitectureEdgeRepository edgeRepository;

    @Mock
    private CodeEndpointRepository endpointRepository;

    @Mock
    private StaticExecutionPathRepository executionPathRepository;

    @Mock
    private RuntimeTraceRepository runtimeTraceRepository;

    @Mock
    private CityLayoutRepository cityLayoutRepository;

    @Mock
    private GitHubService gitHubService;

    @Mock
    private org.springframework.beans.factory.ObjectProvider<ArchitectureAnalysisService> architectureAnalysisServiceProvider;

    @InjectMocks
    private CodeCityService codeCityService;

    private com.impactmapper.entity.Repository repoA;
    private com.impactmapper.entity.Repository repoB;
    private ArchitectureSnapshot snapshotA;

    @BeforeEach
    void setUp() {
        repoA = com.impactmapper.entity.Repository.builder()
                .id(1L)
                .repoName("org/ecommerce-backend")
                .language("Java")
                .defaultBranch("main")
                .build();

        repoB = com.impactmapper.entity.Repository.builder()
                .id(2L)
                .repoName("org/auth-service")
                .language("Java")
                .defaultBranch("main")
                .build();

        snapshotA = ArchitectureSnapshot.builder()
                .id(100L)
                .repository(repoA)
                .commitSha("abc1234")
                .status("ANALYZED")
                .primaryLanguage("Java")
                .analyzedAt(LocalDateTime.now())
                .build();
    }

    // Test 1 & 6: City generation with Controller calling Service and Repository
    @Test
    void testCityGenerationWithControllerCallingServiceAndRepository() {
        ArchitectureNode ctrlNode = ArchitectureNode.builder()
                .snapshot(snapshotA)
                .nodeKey("class:com.example.controller.OrderController")
                .name("OrderController")
                .nodeType("CONTROLLER")
                .packageOrModule("com.example.controller")
                .level(2)
                .startLine(10)
                .endLine(80)
                .build();

        ArchitectureNode srvNode = ArchitectureNode.builder()
                .snapshot(snapshotA)
                .nodeKey("class:com.example.service.OrderService")
                .name("OrderService")
                .nodeType("SERVICE")
                .packageOrModule("com.example.service")
                .level(2)
                .startLine(15)
                .endLine(120)
                .build();

        ArchitectureNode repoNode = ArchitectureNode.builder()
                .snapshot(snapshotA)
                .nodeKey("class:com.example.repository.OrderRepository")
                .name("OrderRepository")
                .nodeType("REPOSITORY")
                .packageOrModule("com.example.repository")
                .level(2)
                .startLine(5)
                .endLine(30)
                .build();

        ArchitectureNode epNode = ArchitectureNode.builder()
                .snapshot(snapshotA)
                .nodeKey("endpoint:POST:/api/orders")
                .name("POST /api/orders")
                .nodeType("API_ENDPOINT")
                .packageOrModule("OrderController")
                .level(3)
                .startLine(25)
                .endLine(35)
                .build();

        List<ArchitectureNode> nodes = List.of(ctrlNode, srvNode, repoNode, epNode);

        ArchitectureEdge edgeExpose = ArchitectureEdge.builder()
                .snapshot(snapshotA)
                .sourceNodeKey(ctrlNode.getNodeKey())
                .targetNodeKey(epNode.getNodeKey())
                .relationshipType("EXPOSES")
                .evidence("REST mapping")
                .evidenceLevel("DIRECTLY_DETECTED")
                .build();

        ArchitectureEdge edgeCallSrv = ArchitectureEdge.builder()
                .snapshot(snapshotA)
                .sourceNodeKey(ctrlNode.getNodeKey())
                .targetNodeKey(srvNode.getNodeKey())
                .relationshipType("CALLS")
                .evidence("Invokes orderService.createOrder() at line 28 [if (stockAvailable)]")
                .evidenceLevel("STATIC_INFERENCE")
                .build();

        ArchitectureEdge edgeCallRepo = ArchitectureEdge.builder()
                .snapshot(snapshotA)
                .sourceNodeKey(srvNode.getNodeKey())
                .targetNodeKey(repoNode.getNodeKey())
                .relationshipType("CALLS")
                .evidence("Invokes orderRepository.save(order) at line 65")
                .evidenceLevel("STATIC_INFERENCE")
                .build();

        List<ArchitectureEdge> edges = List.of(edgeExpose, edgeCallSrv, edgeCallRepo);

        when(nodeRepository.findBySnapshotId(100L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(100L)).thenReturn(edges);
        when(endpointRepository.findBySnapshotIdOrderByRoutePathAsc(100L)).thenReturn(List.of(
                CodeEndpoint.builder()
                        .id(1L)
                        .snapshot(snapshotA)
                        .httpMethod("POST")
                        .routePath("/api/orders")
                        .controllerClass("OrderController")
                        .handlerMethod("createOrder")
                        .nodeKey("endpoint:POST:/api/orders")
                        .build()
        ));

        CityModelDTO city = codeCityService.syncCityModel(repoA, snapshotA);

        assertNotNull(city);
        assertEquals(1L, city.getRepositoryId());
        assertEquals("abc1234", city.getCommitSha());
        assertEquals(3, city.getBuildings().size()); // Controller, Service, Repository buildings
        assertTrue(city.getDistricts().size() >= 2); // API District and Service/Data Districts
        assertEquals(2, city.getRoads().size()); // 2 roads (CALLS)

        // Verify endpoints and execution path were persisted
        verify(endpointRepository, times(1)).saveAllAndFlush(anyList());
        verify(executionPathRepository, times(1)).saveAllAndFlush(anyList());
        verify(cityLayoutRepository, times(1)).save(any(CityLayout.class));
    }

    // Test 10: Multi-repository isolation (City A must not mix with City B)
    @Test
    void testMultiRepositoryIsolation() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(repoA));
        when(repositoryRepository.findById(2L)).thenReturn(Optional.of(repoB));

        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snapshotA));

        ArchitectureSnapshot snapshotB = ArchitectureSnapshot.builder()
                .id(200L)
                .repository(repoB)
                .commitSha("fed9876")
                .status("ANALYZED")
                .build();
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(2L)).thenReturn(Optional.of(snapshotB));

        when(nodeRepository.findBySnapshotId(100L)).thenReturn(List.of(
                ArchitectureNode.builder().snapshot(snapshotA).nodeKey("class:com.repoa.A").name("A").nodeType("CLASS").level(2).build()
        ));
        when(nodeRepository.findBySnapshotId(200L)).thenReturn(List.of(
                ArchitectureNode.builder().snapshot(snapshotB).nodeKey("class:com.repob.B").name("B").nodeType("CLASS").level(2).build()
        ));

        CityModelDTO cityA = codeCityService.getCityModel(1L);
        CityModelDTO cityB = codeCityService.getCityModel(2L);

        assertEquals(1L, cityA.getRepositoryId());
        assertEquals(2L, cityB.getRepositoryId());
        assertEquals("class:com.repoa.A", cityA.getBuildings().get(0).getId());
        assertEquals("class:com.repob.B", cityB.getBuildings().get(0).getId());

        // Zero cross-contamination
        assertFalse(cityA.getBuildings().stream().anyMatch(b -> b.getId().contains("repob")));
        assertFalse(cityB.getBuildings().stream().anyMatch(b -> b.getId().contains("repoa")));
    }

    // Test 8 & 9: Conditional execution paths and branch detection
    @Test
    void testExecutionPathExtractionWithBranchCondition() {
        CodeEndpoint ep = CodeEndpoint.builder()
                .id(50L)
                .repository(repoA)
                .snapshot(snapshotA)
                .httpMethod("POST")
                .routePath("/api/checkout")
                .controllerClass("CheckoutController")
                .handlerMethod("checkout")
                .startLine(30)
                .build();

        StaticExecutionPath path = StaticExecutionPath.builder()
                .id(10L)
                .endpoint(ep)
                .snapshot(snapshotA)
                .totalSteps(2)
                .hasAlternativeBranches(true)
                .inferredSummary("CheckoutController → PaymentService")
                .steps(List.of(
                        StaticExecutionStep.builder()
                                .stepIndex(1)
                                .sourceComponentKey("endpoint:POST:/api/checkout")
                                .sourceComponentName("POST /api/checkout")
                                .targetComponentKey("class:com.example.CheckoutController")
                                .targetComponentName("CheckoutController")
                                .relationshipType("ENTRY_POINT")
                                .isResolved(true)
                                .build(),
                        StaticExecutionStep.builder()
                                .stepIndex(2)
                                .sourceComponentKey("class:com.example.CheckoutController")
                                .sourceComponentName("CheckoutController")
                                .targetComponentKey("class:com.example.PaymentService")
                                .targetComponentName("PaymentService")
                                .relationshipType("CALLS")
                                .branchCondition("user.isVerified()")
                                .evidence("Invokes paymentService.charge() [if (user.isVerified())]")
                                .isResolved(true)
                                .build()
                ))
                .build();

        when(endpointRepository.findById(50L)).thenReturn(Optional.of(ep));
        when(executionPathRepository.findByEndpointId(50L)).thenReturn(Optional.of(path));

        ExecutionPathDTO dto = codeCityService.getStaticExecutionPath(50L);

        assertNotNull(dto);
        assertEquals(2, dto.getTotalSteps());
        assertTrue(dto.getHasAlternativeBranches());
        assertEquals("user.isVerified()", dto.getSteps().get(1).getBranchCondition());
        assertEquals("CALLS", dto.getSteps().get(1).getRelationshipType());
    }

    // Test 14: Runtime trace ingestion
    @Test
    void testRuntimeTraceIngestion() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(repoA));

        TraceIngestDTO ingest = TraceIngestDTO.builder()
                .traceId("trace-xyz-12345")
                .repositoryId(1L)
                .commitSha("abc1234")
                .endpointRoute("/api/orders")
                .httpMethod("POST")
                .statusCode(201)
                .durationMs(42L)
                .spans(List.of(
                        TraceIngestDTO.SpanIngestItem.builder()
                                .spanId("span-1")
                                .componentName("OrderController")
                                .operationName("createOrder")
                                .durationMs(42L)
                                .startOffsetMs(0L)
                                .build(),
                        TraceIngestDTO.SpanIngestItem.builder()
                                .spanId("span-2")
                                .parentSpanId("span-1")
                                .componentName("OrderService")
                                .operationName("save")
                                .durationMs(28L)
                                .startOffsetMs(14L)
                                .build()
                ))
                .build();

        when(runtimeTraceRepository.save(any(RuntimeTrace.class))).thenAnswer(inv -> {
            RuntimeTrace t = inv.getArgument(0);
            t.setId(99L);
            return t;
        });

        RuntimeTraceDTO result = codeCityService.ingestTrace(ingest);

        assertNotNull(result);
        assertEquals("trace-xyz-12345", result.getTraceId());
        assertEquals(2, result.getSpans().size());
        assertEquals("OrderController", result.getSpans().get(0).getComponentName());
        assertEquals("OrderService", result.getSpans().get(1).getComponentName());
    }

    // Test 15: Clean component name stripping extensions & path segments
    @Test
    void testCleanComponentName() {
        assertEquals("app", CodeCityService.cleanComponentName("app.js"));
        assertEquals("app", CodeCityService.cleanComponentName("file:app.js"));
        assertEquals("orderController", CodeCityService.cleanComponentName("controllers/orderController.js"));
        assertEquals("OwnerController", CodeCityService.cleanComponentName("org.springframework.samples.petclinic.owner.OwnerController"));
        assertEquals("OwnerController", CodeCityService.cleanComponentName("class:org.springframework.samples.petclinic.owner.OwnerController"));
        assertEquals("OwnerController", CodeCityService.cleanComponentName("OwnerController.java"));
        assertEquals("api.routes", CodeCityService.cleanComponentName("routes/api.routes.js"));
        assertEquals("js", CodeCityService.cleanComponentName("js"));
        assertEquals("Unknown", CodeCityService.cleanComponentName(null));
        assertEquals("Unknown", CodeCityService.cleanComponentName("   "));
    }

    // Test 16: Safe spatial layout when repository has no subdirectories or zero districts
    @Test
    void testGetCityModel_EmptyDistricts_GracefulHandling() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(repoA));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snapshotA));

        // Create a root node with level 2 but no subdirectories
        ArchitectureNode rootModule = ArchitectureNode.builder()
                .snapshot(snapshotA)
                .nodeKey("file:app.js")
                .name("app.js")
                .nodeType("MODULE")
                .filePath("app.js")
                .level(2)
                .build();

        when(nodeRepository.findBySnapshotId(snapshotA.getId())).thenReturn(List.of(rootModule));
        when(edgeRepository.findBySnapshotId(snapshotA.getId())).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.getCityModel(1L);

        assertNotNull(city);
        assertFalse(city.getDistricts().isEmpty());
        assertEquals(1, city.getDistricts().size());
        assertEquals(1, city.getBuildings().size());
        assertFalse(city.getLandmarks().isEmpty());
        // Verify Landmark Entry Gate has valid districtId
        assertTrue(city.getLandmarks().stream().anyMatch(l -> "landmark_api_entry_gate".equals(l.getId())));
    }

    // Test 17: Robust getComponentDetail lookup with class:js fallback
    @Test
    void testGetComponentDetail_FallbackForLegacyJsKey() {
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snapshotA));

        ArchitectureNode rootModule = ArchitectureNode.builder()
                .snapshot(snapshotA)
                .nodeKey("file:app.js")
                .name("app.js")
                .nodeType("MODULE")
                .filePath("app.js")
                .level(2)
                .build();

        when(nodeRepository.findBySnapshotIdAndNodeKey(snapshotA.getId(), "class:js")).thenReturn(Optional.empty());
        when(nodeRepository.findBySnapshotId(snapshotA.getId())).thenReturn(List.of(rootModule));
        when(edgeRepository.findBySnapshotIdAndTargetNodeKey(snapshotA.getId(), "file:app.js")).thenReturn(Collections.emptyList());
        when(edgeRepository.findBySnapshotIdAndSourceNodeKey(snapshotA.getId(), "file:app.js")).thenReturn(Collections.emptyList());

        ComponentDetailDTO detail = codeCityService.getComponentDetail(1L, "class:js");

        assertNotNull(detail);
        assertEquals("file:app.js", detail.getNodeKey());
        assertEquals("app.js", detail.getName());
    }

    @Test
    void testCacheBehaviorAndLRUEviction() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(repoA));

        ArchitectureSnapshot snap1 = ArchitectureSnapshot.builder().id(101L).repository(repoA).status("ANALYZED").analyzedAt(LocalDateTime.now()).build();
        ArchitectureSnapshot snap2 = ArchitectureSnapshot.builder().id(102L).repository(repoA).status("ANALYZED").analyzedAt(LocalDateTime.now()).build();
        ArchitectureSnapshot snap3 = ArchitectureSnapshot.builder().id(103L).repository(repoA).status("ANALYZED").analyzedAt(LocalDateTime.now()).build();
        ArchitectureSnapshot snap4 = ArchitectureSnapshot.builder().id(104L).repository(repoA).status("ANALYZED").analyzedAt(LocalDateTime.now()).build();

        when(nodeRepository.findBySnapshotId(anyLong())).thenReturn(Collections.emptyList());
        when(edgeRepository.findBySnapshotId(anyLong())).thenReturn(Collections.emptyList());
        when(runtimeTraceRepository.findByRepositoryIdOrderByRecordedAtDesc(anyLong())).thenReturn(Collections.emptyList());

        // 1. Intelligence Cache Miss on snap1
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snap1));
        long tStart = System.nanoTime();
        ArchitectureIntelligenceDTO intel1 = codeCityService.getArchitectureIntelligence(1L);
        long tMissNanos = System.nanoTime() - tStart;
        assertNotNull(intel1);

        // 2. Intelligence Cache Hit on snap1
        tStart = System.nanoTime();
        ArchitectureIntelligenceDTO intel1Cached = codeCityService.getArchitectureIntelligence(1L);
        long tHitNanos = System.nanoTime() - tStart;
        assertSame(intel1, intel1Cached);
        assertTrue(tHitNanos < 5_000_000, "In-memory cache hit should execute in under 5ms, took: " + (tHitNanos / 1_000_000.0) + "ms");

        // 3. Fill cache to capacity (snap2, snap3)
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snap2));
        codeCityService.getArchitectureIntelligence(1L);
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snap3));
        codeCityService.getArchitectureIntelligence(1L);

        // 4. Exceed LRU limit by adding 4th snapshot (snap4) -> snap1 should be evicted!
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snap4));
        codeCityService.getArchitectureIntelligence(1L);

        // Verify snap1 was evicted: re-querying snap1 creates a fresh DTO rather than returning the same instance
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(1L)).thenReturn(Optional.of(snap1));
        ArchitectureIntelligenceDTO intel1AfterEviction = codeCityService.getArchitectureIntelligence(1L);
        assertNotSame(intel1, intel1AfterEviction, "Eldest entry (snap1) should have been evicted when cache exceeded size 3");

        // 5. Invalidation via syncCityModel: snap1 cached, then invalidated by syncCityModel
        codeCityService.syncCityModel(repoA, snap1);
        ArchitectureIntelligenceDTO intel1AfterSync = codeCityService.getArchitectureIntelligence(1L);
        assertNotSame(intel1AfterEviction, intel1AfterSync, "syncCityModel must invalidate the intelligence cache for that snapshot");
    }
}
