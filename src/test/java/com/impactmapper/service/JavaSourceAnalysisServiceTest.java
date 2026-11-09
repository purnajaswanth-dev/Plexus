package com.impactmapper.service;

import com.impactmapper.entity.ArchitectureSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JavaSourceAnalysisServiceTest {

    private JavaSourceAnalysisService javaAnalysisService;
    private ArchitectureSnapshot snapshot;

    @BeforeEach
    void setUp() {
        javaAnalysisService = new JavaSourceAnalysisService();
        snapshot = ArchitectureSnapshot.builder().id(1L).build();
    }

    @Test
    void testAnalyzeSpringControllerAndEndpoints() {
        String source = "package org.springframework.samples.petclinic.owner;\n" +
                "import org.springframework.web.bind.annotation.*;\n" +
                "import org.springframework.stereotype.Controller;\n" +
                "@RestController\n" +
                "@RequestMapping(\"/owners\")\n" +
                "public class OwnerController {\n" +
                "    @GetMapping(\"/{ownerId}\")\n" +
                "    public String findOwner(@PathVariable int ownerId) { return \"owner\"; }\n" +
                "    @PostMapping(\"/new\")\n" +
                "    public String processCreation() { return \"redirect:/owners\"; }\n" +
                "}";

        JavaSourceAnalysisService.AnalysisResult result = javaAnalysisService.analyzeJavaFile(
                "src/main/java/org/springframework/samples/petclinic/owner/OwnerController.java",
                source, snapshot);

        assertNotNull(result);
        assertFalse(result.nodes.isEmpty());

        // Verify Controller node exists
        boolean hasController = result.nodes.stream()
                .anyMatch(n -> "CONTROLLER".equals(n.getNodeType()) && "OwnerController".equals(n.getName()));
        assertTrue(hasController, "Should identify OwnerController as CONTROLLER");

        // Verify API Endpoints exist
        boolean hasGetEndpoint = result.nodes.stream()
                .anyMatch(n -> "API_ENDPOINT".equals(n.getNodeType()) && n.getName().contains("/{ownerId}"));
        assertTrue(hasGetEndpoint, "Should detect GET endpoint for /{ownerId}");

        boolean hasPostEndpoint = result.nodes.stream()
                .anyMatch(n -> "API_ENDPOINT".equals(n.getNodeType()) && n.getName().contains("/new"));
        assertTrue(hasPostEndpoint, "Should detect POST endpoint for /new");

        // Verify EXPOSES edges
        boolean hasExposesEdge = result.edges.stream()
                .anyMatch(e -> "EXPOSES".equals(e.getRelationshipType()));
        assertTrue(hasExposesEdge, "Should generate EXPOSES relationship from controller to endpoints");
    }

    @Test
    void testAnalyzeEntityAndPersistence() {
        String source = "package com.example.model;\n" +
                "import jakarta.persistence.*;\n" +
                "@Entity\n" +
                "@Table(name = \"owners_table\")\n" +
                "public class OwnerEntity implements java.io.Serializable {\n" +
                "    @Id private Long id;\n" +
                "}";

        JavaSourceAnalysisService.AnalysisResult result = javaAnalysisService.analyzeJavaFile(
                "src/main/java/com/example/model/OwnerEntity.java", source, snapshot);

        boolean hasEntity = result.nodes.stream()
                .anyMatch(n -> "ENTITY".equals(n.getNodeType()) && "OwnerEntity".equals(n.getName()));
        assertTrue(hasEntity, "Should identify OwnerEntity as ENTITY");

        boolean hasTable = result.nodes.stream()
                .anyMatch(n -> "DATABASE_TABLE".equals(n.getNodeType()) && n.getName().contains("owners_table"));
        assertTrue(hasTable, "Should identify mapped table: owners_table");

        boolean hasPersistsEdge = result.edges.stream()
                .anyMatch(e -> "PERSISTS_TO".equals(e.getRelationshipType()));
        assertTrue(hasPersistsEdge, "Should generate PERSISTS_TO relationship");
    }

    @Test
    void testMalformedJavaSourceGracefulHandling() {
        String malformed = "public class Malformed { invalid syntax !!!";
        JavaSourceAnalysisService.AnalysisResult result = javaAnalysisService.analyzeJavaFile(
                "src/main/java/com/example/Malformed.java", malformed, snapshot);

        assertNotNull(result);
        assertTrue(result.nodes.isEmpty(), "Malformed source should not crash the analyzer");
    }
}

