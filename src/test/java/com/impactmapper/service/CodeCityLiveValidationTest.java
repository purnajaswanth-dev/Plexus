package com.impactmapper.service;

import com.impactmapper.dto.codecity.CityModelDTO;
import com.impactmapper.dto.codecity.ComponentDetailDTO;
import com.impactmapper.dto.codecity.JourneyGraphDTO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class CodeCityLiveValidationTest {

    @Autowired
    private CodeCityService codeCityService;

    @Autowired
    private DependencyService dependencyService;

    @Autowired
    private com.impactmapper.repository.RepositoryRepository repositoryRepository;

    @Autowired
    private com.impactmapper.repository.ArchitectureSnapshotRepository snapshotRepository;

    @Autowired
    private com.impactmapper.repository.ArchitectureNodeRepository nodeRepository;

    @Autowired
    private com.impactmapper.repository.CodeEndpointRepository endpointRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Test
    void testCheckAndTerminateStaleBackends() {
        var count = jdbcTemplate.queryForObject("SELECT count(*) FROM architecture_nodes WHERE snapshot_id = 20", Integer.class);
        System.out.println("Snapshot 20 nodes count = " + count);
        var maxLen = jdbcTemplate.queryForObject("SELECT coalesce(max(length(annotations_json)), 0) FROM architecture_nodes WHERE snapshot_id = 20", Integer.class);
        System.out.println("Max annotations_json length = " + maxLen);
        var sumLen = jdbcTemplate.queryForObject("SELECT coalesce(sum(length(annotations_json)), 0) FROM architecture_nodes WHERE snapshot_id = 20", Long.class);
        System.out.println("Sum annotations_json length = " + sumLen);
    }

    @Test
    void testDumpLiveRepoDetails() {
        List<com.impactmapper.entity.Repository> repos = repositoryRepository.findAll();
        System.out.println("=== LIVE REPOSITORIES DUMP (" + repos.size() + ") ===");
        for (var r : repos) {
            System.out.println("Repo ID: " + r.getId() + ", Name: " + r.getRepoName() + ", Owner: " + (r.getOwner() != null ? r.getOwner().getId() : "null") + ", Status: " + r.getIndexStatus());
            var snaps = snapshotRepository.findByRepositoryIdOrderByAnalyzedAtDesc(r.getId());
            for (var s : snaps) {
                var nodes = nodeRepository.findBySnapshotId(s.getId());
                long epNodes = nodes.stream().filter(n -> "API_ENDPOINT".equalsIgnoreCase(n.getNodeType())).count();
                var endpoints = endpointRepository.findBySnapshotIdOrderByRoutePathAsc(s.getId());
                System.out.println("   Snapshot ID: " + s.getId() + ", Total Nodes: " + nodes.size() + ", EP Nodes: " + epNodes + ", CodeEndpoint Entities: " + endpoints.size());
                for (var ep : endpoints) {
                    System.out.println("      Endpoint: " + ep.getId() + " -> " + ep.getHttpMethod() + " " + ep.getRoutePath() + " (ctrl=" + ep.getControllerClass() + ", handler=" + ep.getHandlerMethod() + ")");
                }
            }
        }
    }

    @Test
    void testLiveRepo4_EndpointsDiscovery() {
        List<com.impactmapper.dto.codecity.EndpointDTO> endpoints = codeCityService.getEndpoints(4L);
        System.out.println("Repo 4 Endpoints count: " + endpoints.size());
        for (var ep : endpoints) {
            System.out.println("  -> " + ep.getHttpMethod() + " " + ep.getRoutePath() + " (" + ep.getControllerClass() + ")");
        }
    }

    @Test
    void testLiveRepo4_CityModel() {
        // Repository 4 is the JavaScript maritime repository that previously threw 500
        CityModelDTO city = codeCityService.getCityModel(4L);

        assertNotNull(city);
        assertNotNull(city.getDistricts());
        assertFalse(city.getDistricts().isEmpty(), "Districts list should not be empty");
        assertNotNull(city.getBuildings());
        assertFalse(city.getBuildings().isEmpty(), "Buildings list should not be empty");
        assertNotNull(city.getLandmarks());
        assertFalse(city.getLandmarks().isEmpty(), "Landmarks list should not be empty");

        // Verify Landmark Entry Gate has a valid district assigned
        assertTrue(city.getLandmarks().stream()
                .anyMatch(l -> "landmark_api_entry_gate".equals(l.getId()) && l.getDistrictId() != null));
    }

    @Test
    void testLiveRepo4_ComponentDetail_NodeKeyClassJs() {
        // Previously threw 400 Bad Request with "Component not found with key: class:js"
        ComponentDetailDTO detail = codeCityService.getComponentDetail(4L, "class:js");

        assertNotNull(detail);
        assertNotNull(detail.getNodeKey());
        assertNotNull(detail.getName());
    }

    @Test
    void testLiveRepo4_Endpoint35_Journey() {
        // Previously threw 500 Internal Server Error
        JourneyGraphDTO journey = codeCityService.getJourneyGraph(4L, 35L, "STATIC");

        assertNotNull(journey);
        assertEquals("STATIC", journey.getMode());
        assertNotNull(journey.getNodes());
        assertFalse(journey.getNodes().isEmpty());
    }

    @Test
    void testLiveDependencies_GetLibraries() {
        // Previously threw 500 with LazyInitializationException: could not initialize proxy [Repository#4] - no Session
        List<DependencyService.LibrarySummary> libraries = dependencyService.getLibraries(null, null, null, null);

        assertNotNull(libraries);
        assertFalse(libraries.isEmpty(), "Libraries should be populated from live database");
        for (DependencyService.LibrarySummary lib : libraries) {
            assertNotNull(lib.getArtifactId());
            assertNotNull(lib.getRepositories());
        }
    }

    @Autowired
    private OverviewService overviewService;

    @Autowired
    private ImpactAnalysisService impactAnalysisService;

    @Autowired
    private com.impactmapper.controller.RepositoryController repositoryController;

    @Autowired
    private com.impactmapper.controller.DependencyController dependencyController;

    @Autowired
    private com.impactmapper.controller.GraphController graphController;

    @Autowired
    private com.impactmapper.controller.ImpactController impactController;

    @Autowired
    private com.impactmapper.controller.CodeCityController codeCityController;

    @Test
    void testLiveEndToEndControllerEndpointsUnderSecurityContext() {
        java.util.UUID userUuid = java.util.UUID.fromString("11196d93-6abf-4523-82b9-9db4729ce1cb");
        com.impactmapper.security.UserPrincipal principal = com.impactmapper.security.UserPrincipal.builder()
                .appUserId(userUuid)
                .supabaseUserId(userUuid)
                .email("verified-owner@codecity.dev")
                .displayName("Verified Owner")
                .build();
        org.springframework.security.authentication.UsernamePasswordAuthenticationToken auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        try {
            // 1. GET /api/repos
            long t0 = System.currentTimeMillis();
            List<java.util.Map<String, Object>> userRepos = repositoryController.getAllRepositories();
            long tRepo = System.currentTimeMillis() - t0;
            assertNotNull(userRepos);
            assertFalse(userRepos.isEmpty(), "User repos should not be empty");
            System.out.println("1. RepositoryController.getAllRepositories: " + userRepos.size() + " repos in " + tRepo + "ms");

            // 2. GET /api/overview
            t0 = System.currentTimeMillis();
            var overview = overviewService.getOverviewMetrics();
            long tOverview = System.currentTimeMillis() - t0;
            assertNotNull(overview);
            System.out.println("2. OverviewService.getOverviewMetrics: " + overview + " in " + tOverview + "ms");

            // 3. GET /api/dependencies
            t0 = System.currentTimeMillis();
            var libraries = dependencyController.getLibraries(null, null, null, null).getBody();
            long tDeps = System.currentTimeMillis() - t0;
            assertNotNull(libraries);
            assertFalse(libraries.isEmpty(), "Libraries should not be empty");
            System.out.println("3. DependencyController.getLibraries: " + libraries.size() + " libraries in " + tDeps + "ms");

            // 4. GET /api/graph/bipartite
            long t0_graph = System.currentTimeMillis();
            var bipartite = graphController.getBipartiteGraph();
            long tGraph = System.currentTimeMillis() - t0_graph;
            assertNotNull(bipartite);
            assertTrue(bipartite.containsKey("nodes"));
            System.out.println("4. GraphController.getBipartiteEcosystemData: nodes=" + ((List<?>) bipartite.get("nodes")).size() + " in " + tGraph + "ms");

            // 5. POST /api/impact/analyze
            t0 = System.currentTimeMillis();
            var impactResp = impactController.analyzeImpact(java.util.Map.of("artifactId", "spring-boot-starter-web", "toVersion", "3.2.5"));
            long tImpact = System.currentTimeMillis() - t0;
            assertNotNull(impactResp.getBody());
            System.out.println("5. ImpactController.analyzeImpact: outcome=" + impactResp.getBody().getOverallRecommendation() + " in " + tImpact + "ms");

            // 6. GET /api/codecity/repositories/7/city
            t0 = System.currentTimeMillis();
            var cityResp = codeCityController.getCityModel(7L);
            long tCity = System.currentTimeMillis() - t0;
            assertNotNull(cityResp.getBody());
            assertFalse(cityResp.getBody().getDistricts().isEmpty());
            System.out.println("6. CodeCityController.getCityModel(7L): districts=" + cityResp.getBody().getDistricts().size()
                    + ", buildings=" + cityResp.getBody().getBuildings().size() + " in " + tCity + "ms");

            // 6b. GET /api/codecity/repositories/7/city (Cached)
            long t0_cached = System.currentTimeMillis();
            var cityRespCached = codeCityController.getCityModel(7L);
            long tCityCached = System.currentTimeMillis() - t0_cached;
            assertNotNull(cityRespCached.getBody());
            System.out.println("6b. CodeCityController.getCityModel(7L) (CACHED): " + tCityCached + "ms");

            // 7. GET /api/codecity/repositories/7/components?nodeKey=class:js
            t0 = System.currentTimeMillis();
            var compResp = codeCityController.getComponentDetail(7L, "class:js");
            long tComp = System.currentTimeMillis() - t0;
            assertNotNull(compResp.getBody());
            assertNotNull(compResp.getBody().getNodeKey());
            System.out.println("7. CodeCityController.getComponentDetail(7L, 'class:js'): resolved=" + compResp.getBody().getNodeKey()
                    + " (" + compResp.getBody().getName() + ") in " + tComp + "ms");

        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    void testLiveRepo_OverviewMetrics() {
        var metrics = overviewService.getOverviewMetrics();
        assertNotNull(metrics);
        assertTrue(metrics.containsKey("totalRepositories"));
        System.out.println("Overview metrics: totalRepositories=" + metrics.get("totalRepositories")
                + ", totalDependencies=" + metrics.get("totalDependencies"));
    }

    @Test
    void testLiveRepo_ImpactAnalyze() {
        var result = impactAnalysisService.analyzeImpact("org.springframework.boot", "spring-boot-starter-web", "3.0.0", "3.2.5");
        assertNotNull(result);
        assertNotNull(result.getOverallRecommendation());
        System.out.println("Impact analysis outcome: " + result.getOverallRecommendation() + ", affected=" + result.getTotalAffectedRepos());
    }

    @Test
    void testLiveRepo7_CityModelAndComponent() {
        // Repo 7 previously had no snapshot and returned 400
        CityModelDTO city = codeCityService.getCityModel(7L);
        assertNotNull(city);
        assertNotNull(city.getDistricts());
        assertFalse(city.getDistricts().isEmpty());
        System.out.println("Repo 7 City created successfully: districts=" + city.getDistricts().size()
                + ", buildings=" + city.getBuildings().size());

        ComponentDetailDTO detail = codeCityService.getComponentDetail(7L, "class:js");
        assertNotNull(detail);
        System.out.println("Repo 7 Component class:js detail resolved: name=" + detail.getName());
    }
}
