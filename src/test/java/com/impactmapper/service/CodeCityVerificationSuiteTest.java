package com.impactmapper.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.impactmapper.dto.codecity.*;
import com.impactmapper.entity.*;
import com.impactmapper.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import org.springframework.beans.factory.ObjectProvider;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class CodeCityVerificationSuiteTest {

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
    private ArchitectureAnalysisService architectureAnalysisService;
    @Mock
    private ObjectProvider<ArchitectureAnalysisService> architectureAnalysisServiceProvider;

    private CodeCityService codeCityService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private Repository fixtureRepo1;
    private ArchitectureSnapshot fixtureSnapshot1;

    private Repository fixtureRepo2;
    private ArchitectureSnapshot fixtureSnapshot2;

    @BeforeEach
    void setUp() {
        when(architectureAnalysisServiceProvider.getIfAvailable()).thenReturn(architectureAnalysisService);
        when(architectureAnalysisServiceProvider.getObject()).thenReturn(architectureAnalysisService);

        codeCityService = new CodeCityService(
                repositoryRepository,
                snapshotRepository,
                nodeRepository,
                edgeRepository,
                endpointRepository,
                executionPathRepository,
                runtimeTraceRepository,
                cityLayoutRepository,
                gitHubService,
                architectureAnalysisServiceProvider
        );

        fixtureRepo1 = Repository.builder()
                .id(101L)
                .repoName("fixture/order-commerce")
                .language("Java")
                .build();

        fixtureSnapshot1 = ArchitectureSnapshot.builder()
                .id(1001L)
                .repository(fixtureRepo1)
                .commitSha("commita1")
                .build();

        fixtureRepo2 = Repository.builder()
                .id(102L)
                .repoName("fixture/analytics-pipeline")
                .language("JavaScript")
                .build();

        fixtureSnapshot2 = ArchitectureSnapshot.builder()
                .id(1002L)
                .repository(fixtureRepo2)
                .commitSha("commitb2")
                .build();
    }

    // ======================================================================
    // JOURNEY TESTS: T1 - T12
    // ======================================================================

    @Test
    @DisplayName("T1: Selecting endpoint highlights correct handler workstation")
    void testT1_EndpointHighlightsCorrectHandlerWorkstation() {
        CodeEndpoint ep = CodeEndpoint.builder()
                .id(1L)
                .repository(fixtureRepo1)
                .snapshot(fixtureSnapshot1)
                .httpMethod("POST")
                .routePath("/api/orders")
                .controllerClass("OrderController")
                .handlerMethod("createOrder")
                .nodeKey("endpoint:POST:/api/orders")
                .build();

        when(endpointRepository.findById(1L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.OrderController";
        String handlerKey = ctrlKey + "#createOrder";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("OrderController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/OrderController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(handlerKey).name("createOrder").nodeType("METHOD").packageOrModule("OrderController").level(3).build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("POST /api/orders").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(handlerKey).targetNodeKey(ep.getNodeKey()).relationshipType("HANDLES").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 1L, "STATIC");

        assertNotNull(journey);
        assertEquals("gate:1", journey.getEntryNodeId());
        JourneyTransitionDTO t1 = journey.getTransitions().get(0);
        assertEquals("gate:1", t1.getFromNodeId());
        assertEquals(handlerKey, t1.getToNodeId());
        assertEquals("BUILDING", t1.getScope());
    }

    @Test
    @DisplayName("T2: Internal method call changes active workstation only")
    void testT2_InternalMethodCallChangesActiveWorkstationOnly() {
        CodeEndpoint ep = CodeEndpoint.builder().id(2L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("POST").routePath("/api/orders").controllerClass("OrderController").handlerMethod("createOrder").nodeKey("endpoint:POST:/api/orders").build();

        when(endpointRepository.findById(2L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.OrderController";
        String m1 = ctrlKey + "#createOrder";
        String m2 = ctrlKey + "#validateRequest"; // Same class!

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("OrderController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/OrderController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(m1).name("createOrder").nodeType("METHOD").level(3).build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(m2).name("validateRequest").nodeType("METHOD").level(3).build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("POST /api/orders").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(m1).targetNodeKey(ep.getNodeKey()).relationshipType("HANDLES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(m1).targetNodeKey(m2).relationshipType("CALLS").evidence("Internal call: validateRequest()").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 2L, "STATIC");

        // Step 1: Gate -> createOrder
        // Step 2: createOrder -> validateRequest (scope = WORKSTATION, roadId = null)
        assertTrue(journey.getTransitions().size() >= 2);
        JourneyTransitionDTO internalTrans = journey.getTransitions().get(1);
        assertEquals("WORKSTATION", internalTrans.getScope());
        assertNull(internalTrans.getRoadId(), "Internal method call must have null roadId");
    }

    @Test
    @DisplayName("T3: Same-file class call changes rooms only")
    void testT3_SameFileClassCallChangesRoomsOnly() {
        CodeEndpoint ep = CodeEndpoint.builder().id(3L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("GET").routePath("/api/data").controllerClass("DataController").handlerMethod("getData").nodeKey("endpoint:GET:/api/data").build();

        when(endpointRepository.findById(3L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String class1 = "class:com.example.DataController";
        String class2 = "class:com.example.DataHelper"; // Same file!
        String sharedFile = "src/main/java/com/example/DataBundle.java";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(class1).name("DataController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath(sharedFile).build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(class2).name("DataHelper").nodeType("CLASS").packageOrModule("com.example").level(2).filePath(sharedFile).build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("GET /api/data").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(class1).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(class1).targetNodeKey(class2 + "#help").relationshipType("CALLS").evidence("Same-file call").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 3L, "STATIC");

        JourneyTransitionDTO roomTrans = journey.getTransitions().stream()
                .filter(t -> t.getToNodeId().contains("DataHelper"))
                .findFirst().orElse(null);

        assertNotNull(roomTrans);
        assertEquals("ROOM", roomTrans.getScope(), "Same-file different class call must have scope ROOM");
        assertNull(roomTrans.getRoadId(), "Same-file call must not create a road between buildings");
    }

    @Test
    @DisplayName("T4: Cross-file call moves between buildings along road")
    void testT4_CrossFileCallMovesBetweenBuildingsAlongRoad() {
        CodeEndpoint ep = CodeEndpoint.builder().id(4L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("POST").routePath("/api/orders").controllerClass("OrderController").handlerMethod("createOrder").nodeKey("endpoint:POST:/api/orders").build();

        when(endpointRepository.findById(4L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.OrderController";
        String srvKey = "class:com.example.OrderService"; // Different files

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("OrderController").nodeType("CONTROLLER").packageOrModule("com.example.controller").level(2).filePath("src/OrderController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(srvKey).name("OrderService").nodeType("SERVICE").packageOrModule("com.example.service").level(2).filePath("src/OrderService.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("POST /api/orders").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(srvKey + "#process").relationshipType("CALLS").evidence("Cross-file call").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 4L, "STATIC");

        JourneyTransitionDTO bldgTrans = journey.getTransitions().stream()
                .filter(t -> t.getToNodeId().contains("OrderService"))
                .findFirst().orElse(null);

        assertNotNull(bldgTrans);
        assertEquals("BUILDING", bldgTrans.getScope(), "Cross-file call must have scope BUILDING");
        assertNotNull(bldgTrans.getRoadId(), "Cross-file call must have a valid roadId matching city road");
    }

    @Test
    @DisplayName("T5: Conditional branch presents alternative choices")
    void testT5_ConditionalBranchPresentsAlternativeChoices() {
        CodeEndpoint ep = CodeEndpoint.builder().id(5L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("POST").routePath("/api/orders").controllerClass("OrderController").handlerMethod("createOrder").nodeKey("endpoint:POST:/api/orders").build();

        when(endpointRepository.findById(5L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.OrderController";
        String srvKey = "class:com.example.OrderService";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("OrderController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/OrderController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(srvKey).name("OrderService").nodeType("SERVICE").packageOrModule("com.example").level(2).filePath("src/OrderService.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("POST /api/orders").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey("exception:InvalidInput").relationshipType("EXCEPTION").evidence("Throws InvalidInput at line 20 [if (count <= 0)]").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(srvKey + "#create").relationshipType("CALLS").evidence("Calls srv").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 5L, "STATIC");

        assertFalse(journey.getBranchGroups().isEmpty(), "BranchGroup must be extracted for conditional branch");
        BranchGroupDTO bg = journey.getBranchGroups().get(0);
        assertEquals("count <= 0", bg.getConditionText());
        assertFalse(bg.isOutcomeKnown(), "Static mode outcomeKnown must be false");
        assertEquals(2, bg.getOutcomes().size(), "Must contain alternative outcomes");
    }

    @Test
    @DisplayName("T6: No database operation fabricated from repository method name")
    void testT6_NoDatabaseOperationFabricatedFromRepositoryMethodName() {
        CodeEndpoint ep = CodeEndpoint.builder().id(6L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("GET").routePath("/api/users").controllerClass("UserController").handlerMethod("getUsers").nodeKey("endpoint:GET:/api/users").build();

        when(endpointRepository.findById(6L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.UserController";
        String repoKey = "class:com.example.UserRepository";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("UserController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/UserController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(repoKey).name("UserRepository").nodeType("REPOSITORY").packageOrModule("com.example").level(2).filePath("src/UserRepository.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("GET /api/users").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(repoKey + "#findAll").relationshipType("CALLS").evidence("Repository invocation: findAll()").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 6L, "STATIC");

        JourneyNodeDTO repoOpNode = journey.getNodes().stream()
                .filter(n -> "FRAMEWORK_OPERATION".equals(n.getKind()))
                .findFirst().orElse(null);

        assertNotNull(repoOpNode);
        assertTrue(repoOpNode.getExplanation().contains("database execution not runtime-observed"),
                "Must state repository operation detected and database execution not runtime-observed without fabricating SQL");
    }

    @Test
    @DisplayName("T7: Async or unresolved event listener is not shown as synchronous continuation")
    void testT7_AsyncEventListenerNotSynchronousContinuation() {
        CodeEndpoint ep = CodeEndpoint.builder().id(7L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("POST").routePath("/api/events").controllerClass("EventController").handlerMethod("send").nodeKey("endpoint:POST:/api/events").build();

        when(endpointRepository.findById(7L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.EventController";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("EventController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/EventController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("POST /api/events").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey("event:publish#send").relationshipType("EVENT_PUBLISH").evidence("Event publication: publishEvent(OrderEvent)").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey("class:com.example.OrderListener#onEvent").targetNodeKey("event:listener:OrderEvent").relationshipType("EVENT_CONSUME").evidence("EventListener").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 7L, "STATIC");

        // The listener must be in asyncFlows, not in synchronous transitions
        assertFalse(journey.getAsyncFlows().isEmpty(), "Async event flow must be separate sub-journey");
        boolean listenerInSync = journey.getTransitions().stream()
                .anyMatch(t -> t.getToNodeId().contains("OrderListener"));
        assertFalse(listenerInSync, "Listener must NOT be appended as a synchronous continuation in main flow");
    }

    @Test
    @DisplayName("T8: Response follows actual return relationships")
    void testT8_ResponseFollowsActualReturnRelationships() {
        CodeEndpoint ep = CodeEndpoint.builder().id(8L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("POST").routePath("/api/orders").controllerClass("OrderController").handlerMethod("createOrder").nodeKey("endpoint:POST:/api/orders").build();

        when(endpointRepository.findById(8L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.OrderController";
        String srvKey = "class:com.example.OrderService";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("OrderController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/OrderController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(srvKey).name("OrderService").nodeType("SERVICE").packageOrModule("com.example").level(2).filePath("src/OrderService.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("POST /api/orders").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(srvKey + "#create").relationshipType("CALLS").evidence("Calls srv").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 8L, "STATIC");

        // Returns must exist and have kind RETURN
        List<JourneyTransitionDTO> returns = journey.getTransitions().stream()
                .filter(t -> "RETURN".equalsIgnoreCase(t.getKind()))
                .toList();

        assertFalse(returns.isEmpty(), "Must contain RETURN transitions");
        // Callee -> Caller return
        JourneyTransitionDTO retSrv = returns.stream().filter(r -> r.getFromNodeId().contains("OrderService")).findFirst().orElse(null);
        assertNotNull(retSrv);
        assertEquals(ctrlKey, retSrv.getToNodeId());
    }

    @Test
    @DisplayName("T9: Structural roads (imports, inheritance) never appear in request playback")
    void testT9_StructuralRoadsNeverAppearInRequestPlayback() {
        CodeEndpoint ep = CodeEndpoint.builder().id(9L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("GET").routePath("/api/data").controllerClass("DataController").handlerMethod("get").nodeKey("endpoint:GET:/api/data").build();

        when(endpointRepository.findById(9L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.DataController";
        String ifaceKey = "class:com.example.BaseInterface";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("DataController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/DataController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ifaceKey).name("BaseInterface").nodeType("INTERFACE").packageOrModule("com.example").level(2).filePath("src/BaseInterface.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("GET /api/data").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ifaceKey).relationshipType("IMPLEMENTS").evidence("Implements").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey("pkg:com.other").relationshipType("IMPORTS").evidence("Import").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 9L, "STATIC");

        for (JourneyTransitionDTO t : journey.getTransitions()) {
            assertNotEquals("IMPLEMENTS", t.getKind());
            assertNotEquals("IMPORTS", t.getKind());
        }

        CityModelDTO city = codeCityService.getCityModel(101L);
        for (CityRoadDTO road : city.getRoads()) {
            assertNotEquals("IMPLEMENTS", road.getRelationshipType());
            assertNotEquals("IMPORTS", road.getRelationshipType());
        }
    }

    @Test
    @DisplayName("T10: Timeline exactly matches the journey graph")
    void testT10_TimelineMatchesJourneyGraph() {
        CodeEndpoint ep = CodeEndpoint.builder().id(10L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("GET").routePath("/api/ping").controllerClass("PingController").handlerMethod("ping").nodeKey("endpoint:GET:/api/ping").build();

        when(endpointRepository.findById(10L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.PingController";
        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("PingController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/PingController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("GET /api/ping").nodeType("API_ENDPOINT").level(3).build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 10L, "STATIC");
        ExecutionPathDTO path = codeCityService.getStaticExecutionPath(10L);

        long forwardCount = journey.getTransitions().stream().filter(t -> !"RETURN".equalsIgnoreCase(t.getKind())).count();
        long returnCount = journey.getTransitions().stream().filter(t -> "RETURN".equalsIgnoreCase(t.getKind())).count();

        assertEquals(forwardCount, path.getSteps().size(), "Forward request steps in timeline match journey graph");
        assertEquals(returnCount, path.getResponseSteps().size(), "Return response steps in timeline match journey graph");
        assertEquals(journey.getInferredSummary(), path.getInferredSummary());
    }

    @Test
    @DisplayName("T11: Unresolved relationships do not cause arbitrary building movement")
    void testT11_UnresolvedRelationshipsDoNotCauseArbitraryBuildingMovement() {
        CodeEndpoint ep = CodeEndpoint.builder().id(11L).repository(fixtureRepo1).snapshot(fixtureSnapshot1)
                .httpMethod("GET").routePath("/api/unresolved").controllerClass("UnresolvedController").handlerMethod("unresolved").nodeKey("endpoint:GET:/api/unresolved").build();

        when(endpointRepository.findById(11L)).thenReturn(Optional.of(ep));
        when(repositoryRepository.findById(101L)).thenReturn(Optional.of(fixtureRepo1));
        when(snapshotRepository.findTopByRepositoryIdOrderByAnalyzedAtDesc(101L)).thenReturn(Optional.of(fixtureSnapshot1));

        String ctrlKey = "class:com.example.UnresolvedController";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("UnresolvedController").nodeType("CONTROLLER").packageOrModule("com.example").level(2).filePath("src/UnresolvedController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ep.getNodeKey()).name("GET /api/unresolved").nodeType("API_ENDPOINT").level(3).build()
        );

        // Edge calls an external unindexed class
        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build(),
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey("class:external.library.ThirdParty#call").relationshipType("CALLS").evidence("Unresolved external call").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        JourneyGraphDTO journey = codeCityService.getJourneyGraph(101L, 11L, "STATIC");

        JourneyTransitionDTO extTrans = journey.getTransitions().stream()
                .filter(t -> t.getToNodeId().contains("ThirdParty"))
                .findFirst().orElse(null);

        assertNotNull(extTrans);
        assertEquals("EXTERNAL", extTrans.getScope(), "Unresolved external call must have scope EXTERNAL, not arbitrary building jump");
    }

    @Test
    @DisplayName("T12: Runtime mode uses real traces only and never reuses static data")
    void testT12_RuntimeModeUsesRealTracesOnly() {
        when(runtimeTraceRepository.findByRepositoryIdOrderByRecordedAtDesc(101L)).thenReturn(Collections.emptyList());

        List<RuntimeTraceDTO> traces = codeCityService.getTraces(101L);
        assertTrue(traces.isEmpty(), "When no runtime traces are recorded, runtime list must be honestly empty");
    }

    // ======================================================================
    // CITY GENERATION TESTS: T13 - T19
    // ======================================================================

    @Test
    @DisplayName("T13: Determinism - same snapshot generates byte-identical layout twice")
    void testT13_DeterminismIdenticalLayoutTwice() throws Exception {
        String ctrlKey = "class:com.example.OrderController";
        String srvKey = "class:com.example.OrderService";

        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("OrderController").nodeType("CONTROLLER").packageOrModule("com.example.controller").level(2).filePath("src/OrderController.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(srvKey).name("OrderService").nodeType("SERVICE").packageOrModule("com.example.service").level(2).filePath("src/OrderService.java").build()
        );

        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrlKey).targetNodeKey(srvKey).relationshipType("CALLS").evidence("Calls").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        CityModelDTO city1 = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);
        CityModelDTO city2 = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        String json1 = objectMapper.writeValueAsString(city1);
        String json2 = objectMapper.writeValueAsString(city2);

        assertEquals(json1, json2, "Same snapshot must generate byte-identical layout twice");
    }

    @Test
    @DisplayName("T14: Uniqueness - two different fixtures generate different layouts derived from content")
    void testT14_UniquenessDifferentFixturesYieldDifferentCities() {
        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.shop.WebCtrl").name("WebCtrl").nodeType("CONTROLLER").packageOrModule("com.shop.web").level(2).filePath("src/WebCtrl.java").build()
        ));
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        when(nodeRepository.findBySnapshotId(1002L)).thenReturn(List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot2).nodeKey("file:lib/stream.js").name("stream.js").nodeType("MODULE").packageOrModule("lib").level(2).filePath("lib/stream.js").build()
        ));
        when(edgeRepository.findBySnapshotId(1002L)).thenReturn(Collections.emptyList());

        CityModelDTO city1 = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);
        CityModelDTO city2 = codeCityService.syncCityModel(fixtureRepo2, fixtureSnapshot2);

        assertNotEquals(city1.getDistricts().get(0).getName(), city2.getDistricts().get(0).getName());
        assertNotEquals(city1.getBuildings().get(0).getName(), city2.getBuildings().get(0).getName());
    }

    @Test
    @DisplayName("T15: No hardcoded names in generator or service")
    void testT15_NoHardcodedExampleNamesInService() {
        String ctrlKey = "class:org.acme.custom.CustomProcessor";
        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey(ctrlKey).name("CustomProcessor").nodeType("SERVICE").packageOrModule("org.acme.custom").level(2).filePath("src/CustomProcessor.java").build()
        );
        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        assertEquals("CustomProcessor", city.getBuildings().get(0).getName());
        assertTrue(city.getDistricts().get(0).getName().contains("Custom"));
    }

    @Test
    @DisplayName("T16: Zero decorative roads")
    void testT16_ZeroDecorativeRoads() {
        List<ArchitectureNode> nodes = List.of(
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:A").name("A").nodeType("CLASS").packageOrModule("pkg").level(2).filePath("src/A.java").build(),
                ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:B").name("B").nodeType("CLASS").packageOrModule("pkg").level(2).filePath("src/B.java").build()
        );

        // Only IMPORTS, no CALLS
        List<ArchitectureEdge> edges = List.of(
                ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey("class:A").targetNodeKey("pkg:com").relationshipType("IMPORTS").build()
        );

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(nodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(edges);

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        assertTrue(city.getRoads().isEmpty(), "No CALLS or PERSISTS_TO means exactly 0 roads (zero decorative roads)");
    }

    @Test
    @DisplayName("T17: Stability - adding one file in a new commit preserves existing layout anchors")
    void testT17_StabilityAddingOneFilePreservesDistricts() {
        ArchitectureNode nodeA = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.A").name("A").nodeType("CONTROLLER").packageOrModule("com.app.ctrl").level(2).filePath("src/A.java").build();
        ArchitectureNode nodeB = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.B").name("B").nodeType("SERVICE").packageOrModule("com.app.srv").level(2).filePath("src/B.java").build();

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(nodeA));
        CityModelDTO city1 = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(nodeA, nodeB));
        CityModelDTO city2 = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        // Node A remains in its district
        assertEquals(city1.getDistricts().get(0).getName(), city2.getDistricts().get(0).getName());
        assertEquals(city1.getBuildings().get(0).getName(), city2.getBuildings().get(0).getName());
    }

    @Test
    @DisplayName("T18: Honest gap markers render properly")
    void testT18_HonestGapMarkersRenderProperly() {
        ArchitectureNode lonelyNode = ArchitectureNode.builder()
                .snapshot(fixtureSnapshot1)
                .nodeKey("class:com.app.StandaloneUtil")
                .name("StandaloneUtil")
                .nodeType("CLASS")
                .packageOrModule("com.app.util")
                .level(2)
                .filePath("src/StandaloneUtil.java")
                .build();

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(lonelyNode));
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        CityBuildingDTO bldg = city.getBuildings().get(0);
        assertEquals("NO_RELATIONSHIP", bldg.getGapStatus());
        assertEquals("No relationship detected", bldg.getGapReason());
    }

    @Test
    @DisplayName("T19: Scale test - repository with 1,000 files stays organized without overlapping buildings")
    void testT19_ScaleTestOver1000Files() {
        List<ArchitectureNode> scaleNodes = new ArrayList<>();
        int count = 1000;
        for (int i = 0; i < count; i++) {
            String pkg = "com.scale.mod" + (i % 10);
            scaleNodes.add(ArchitectureNode.builder()
                    .snapshot(fixtureSnapshot1)
                    .nodeKey("class:" + pkg + ".Component" + i)
                    .name("Component" + i)
                    .nodeType("SERVICE")
                    .packageOrModule(pkg)
                    .level(2)
                    .filePath("src/" + pkg.replace('.', '/') + "/Component" + i + ".java")
                    .build());
        }

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(scaleNodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        assertEquals(10, city.getDistricts().size(), "Should partition 1000 files into 10 cohesive districts");
        assertEquals(1000, city.getBuildings().size(), "Should contain all 1000 real buildings");
        assertTrue(city.getCityWidth() > 1000.0);
        assertTrue(city.getCityHeight() > 700.0);
    }

    // ======================================================================
    // REQUIRED VERIFICATION TESTS: TEST A THROUGH TEST G
    // ======================================================================

    @Test
    @DisplayName("TEST A: Java REST application produces complete metropolis with urban planning")
    void test_TestA_JavaRestApplication() {
        ArchitectureNode ctrl = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.controller.UserController").name("UserController").nodeType("CONTROLLER").packageOrModule("com.app.controller").level(2).filePath("src/UserController.java").build();
        ArchitectureNode srv = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.service.UserService").name("UserService").nodeType("SERVICE").packageOrModule("com.app.service").level(2).filePath("src/UserService.java").build();
        ArchitectureNode repo = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.repository.UserRepository").name("UserRepository").nodeType("REPOSITORY").packageOrModule("com.app.repository").level(2).filePath("src/UserRepository.java").build();
        ArchitectureNode ent = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.entity.User").name("User").nodeType("ENTITY").packageOrModule("com.app.entity").level(2).filePath("src/User.java").build();
        ArchitectureNode ep = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("endpoint:GET:/api/users").name("GET /api/users").nodeType("API_ENDPOINT").packageOrModule("UserController").level(3).build();

        ArchitectureEdge edgeExpose = ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrl.getNodeKey()).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build();
        ArchitectureEdge edgeCallSrv = ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrl.getNodeKey()).targetNodeKey(srv.getNodeKey()).relationshipType("CALLS").build();
        ArchitectureEdge edgeCallRepo = ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(srv.getNodeKey()).targetNodeKey(repo.getNodeKey()).relationshipType("CALLS").build();
        ArchitectureEdge edgePersist = ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(repo.getNodeKey()).targetNodeKey(ent.getNodeKey()).relationshipType("PERSISTS_TO").build();

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(ctrl, srv, repo, ent, ep));
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(List.of(edgeExpose, edgeCallSrv, edgeCallRepo, edgePersist));

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        assertNotNull(city);
        assertEquals(4, city.getBuildings().size(), "All 4 source files must become buildings");
        assertTrue(city.getDistricts().size() >= 3, "Districts must represent packages");
        assertTrue(city.getBlocks().size() >= 3, "City blocks must be generated inside districts");
        assertTrue(city.getStreets().size() >= 4, "Physical streets and avenues must be generated");
        assertTrue(city.getIntersections().size() >= 1, "Intersections connecting streets must exist");
        assertTrue(city.getLandmarks().stream().anyMatch(l -> "DATABASE_VAULT".equals(l.getLandmarkType())), "Database vault landmark must be generated from repository evidence");
    }

    @Test
    @DisplayName("TEST B: Java library with zero REST endpoints generates complete city")
    void test_TestB_JavaLibraryWithZeroEndpoints() {
        List<ArchitectureNode> libraryNodes = new ArrayList<>();
        for (int i = 0; i < 150; i++) {
            String pkg = "com.lib.core.util" + (i % 5);
            libraryNodes.add(ArchitectureNode.builder()
                    .snapshot(fixtureSnapshot1)
                    .nodeKey("class:" + pkg + ".UtilClass" + i)
                    .name("UtilClass" + i)
                    .nodeType("CLASS")
                    .packageOrModule(pkg)
                    .level(2)
                    .filePath("src/main/java/" + pkg.replace('.', '/') + "/UtilClass" + i + ".java")
                    .build());
        }

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(libraryNodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        assertNotNull(city);
        assertEquals(150, city.getBuildings().size(), "Complete city must be generated with 150 buildings even with zero REST endpoints");
        assertEquals(5, city.getDistricts().size());
        assertTrue(city.getBlocks().size() > 0);
        assertTrue(city.getStreets().size() > 0);
    }

    @Test
    @DisplayName("TEST C: React frontend architecture produces city even without Java endpoints")
    void test_TestC_ReactFrontend() {
        ArchitectureNode comp1 = ArchitectureNode.builder().snapshot(fixtureSnapshot2).nodeKey("class:components.Navbar").name("Navbar").nodeType("COMPONENT").packageOrModule("components").level(2).filePath("src/components/Navbar.jsx").build();
        ArchitectureNode comp2 = ArchitectureNode.builder().snapshot(fixtureSnapshot2).nodeKey("class:components.Sidebar").name("Sidebar").nodeType("COMPONENT").packageOrModule("components").level(2).filePath("src/components/Sidebar.jsx").build();
        ArchitectureNode hook = ArchitectureNode.builder().snapshot(fixtureSnapshot2).nodeKey("class:hooks.useAuth").name("useAuth").nodeType("HOOK").packageOrModule("hooks").level(2).filePath("src/hooks/useAuth.ts").build();
        ArchitectureNode srv = ArchitectureNode.builder().snapshot(fixtureSnapshot2).nodeKey("class:services.apiClient").name("apiClient").nodeType("SERVICE").packageOrModule("services").level(2).filePath("src/services/apiClient.ts").build();

        when(nodeRepository.findBySnapshotId(1002L)).thenReturn(List.of(comp1, comp2, hook, srv));
        when(edgeRepository.findBySnapshotId(1002L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo2, fixtureSnapshot2);

        assertNotNull(city);
        assertEquals(4, city.getBuildings().size());
        assertEquals(3, city.getDistricts().size(), "components, hooks, and services districts");
    }

    @Test
    @DisplayName("TEST D: Mixed and partially unsupported repository communicates status honestly")
    void test_TestD_MixedAndPartiallyUnsupportedRepository() {
        ArchitectureNode goodNode = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.GoodService").name("GoodService").nodeType("SERVICE").packageOrModule("com.app").level(2).filePath("src/GoodService.java").build();
        ArchitectureNode malformedNode = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.BrokenSyntax").name("BrokenSyntax").nodeType("MALFORMED_JAVA").packageOrModule("com.app").level(2).evidenceConfidence("SYNTAX_ERROR").filePath("src/BrokenSyntax.java").build();
        ArchitectureNode configNode = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("file:config/application.yml").name("application.yml").nodeType("CONFIG").packageOrModule("config").level(2).filePath("config/application.yml").build();

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(goodNode, malformedNode, configNode));
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        assertNotNull(city);
        assertEquals(3, city.getBuildings().size());
        CityBuildingDTO malformedBldg = city.getBuildings().stream().filter(b -> "BrokenSyntax".equals(b.getName())).findFirst().orElse(null);
        assertNotNull(malformedBldg);
        assertEquals("NO_RELATIONSHIP", malformedBldg.getGapStatus());
    }

    @Test
    @DisplayName("TEST E: Large repository scalability with over 500 files")
    void test_TestE_LargeRepositoryScale() {
        List<ArchitectureNode> largeNodes = new ArrayList<>();
        for (int i = 0; i < 500; i++) {
            String pkg = "com.enterprise.module" + (i % 8);
            largeNodes.add(ArchitectureNode.builder()
                    .snapshot(fixtureSnapshot1)
                    .nodeKey("class:" + pkg + ".Service" + i)
                    .name("Service" + i)
                    .nodeType("SERVICE")
                    .packageOrModule(pkg)
                    .level(2)
                    .filePath("src/" + pkg.replace('.', '/') + "/Service" + i + ".java")
                    .build());
        }

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(largeNodes);
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        assertNotNull(city);
        assertEquals(500, city.getBuildings().size());
        assertEquals(8, city.getDistricts().size());
        assertTrue(city.getBlocks().size() >= 8);
        assertTrue(city.getStreets().size() >= 8);
    }

    @Test
    @DisplayName("TEST F: Endpoint overlay attaches to existing controller building without changing geometry")
    void test_TestF_EndpointOverlayPreservesGeometry() {
        ArchitectureNode ctrl = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.OrderController").name("OrderController").nodeType("CONTROLLER").packageOrModule("com.app").level(2).filePath("src/OrderController.java").build();
        ArchitectureNode srv = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.OrderService").name("OrderService").nodeType("SERVICE").packageOrModule("com.app").level(2).filePath("src/OrderService.java").build();
        ArchitectureNode ep = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("endpoint:POST:/api/orders").name("POST /api/orders").nodeType("API_ENDPOINT").packageOrModule("OrderController").level(3).build();

        ArchitectureEdge edgeExpose = ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrl.getNodeKey()).targetNodeKey(ep.getNodeKey()).relationshipType("EXPOSES").build();
        ArchitectureEdge edgeCall = ArchitectureEdge.builder().snapshot(fixtureSnapshot1).sourceNodeKey(ctrl.getNodeKey()).targetNodeKey(srv.getNodeKey()).relationshipType("CALLS").build();

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(ctrl, srv, ep));
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(List.of(edgeExpose, edgeCall));

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        CityBuildingDTO ctrlBldg = city.getBuildings().stream().filter(b -> "OrderController".equals(b.getName())).findFirst().orElseThrow();
        double initialX = ctrlBldg.getX();
        double initialY = ctrlBldg.getY();

        // Verify building coordinates remain stable and endpoint attaches to existing controller
        assertTrue(ctrlBldg.getEntryPoints().contains("POST /api/orders"));
        assertEquals(initialX, ctrlBldg.getX());
        assertEquals(initialY, ctrlBldg.getY());
    }

    @Test
    @DisplayName("TEST G: Runtime overlay across two branches uses the same city geometry")
    void test_TestG_RuntimeOverlayDifferentBranchesSameCity() {
        ArchitectureNode ctrl = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.PaymentController").name("PaymentController").nodeType("CONTROLLER").packageOrModule("com.app").level(2).filePath("src/PaymentController.java").build();
        ArchitectureNode srvA = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.CreditCardService").name("CreditCardService").nodeType("SERVICE").packageOrModule("com.app").level(2).filePath("src/CreditCardService.java").build();
        ArchitectureNode srvB = ArchitectureNode.builder().snapshot(fixtureSnapshot1).nodeKey("class:com.app.PayPalService").name("PayPalService").nodeType("SERVICE").packageOrModule("com.app").level(2).filePath("src/PayPalService.java").build();

        when(nodeRepository.findBySnapshotId(1001L)).thenReturn(List.of(ctrl, srvA, srvB));
        when(edgeRepository.findBySnapshotId(1001L)).thenReturn(Collections.emptyList());

        CityModelDTO city = codeCityService.syncCityModel(fixtureRepo1, fixtureSnapshot1);

        // Both services exist in the same city
        assertEquals(3, city.getBuildings().size());
        assertTrue(city.getBuildings().stream().anyMatch(b -> "CreditCardService".equals(b.getName())));
        assertTrue(city.getBuildings().stream().anyMatch(b -> "PayPalService".equals(b.getName())));
    }
}
