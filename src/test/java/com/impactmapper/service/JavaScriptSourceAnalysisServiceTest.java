package com.impactmapper.service;

import com.impactmapper.entity.ArchitectureSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JavaScriptSourceAnalysisServiceTest {

    private JavaScriptSourceAnalysisService jsAnalysisService;
    private ArchitectureSnapshot snapshot;

    @BeforeEach
    void setUp() {
        jsAnalysisService = new JavaScriptSourceAnalysisService();
        snapshot = ArchitectureSnapshot.builder().id(2L).build();
    }

    @Test
    void testAnalyzeJsFileImportsAndRoutes() {
        String jsContent = "import express from 'express';\n" +
                "import cors from 'cors';\n" +
                "const app = express();\n" +
                "export class AuthController extends BaseController {\n" +
                "}\n" +
                "app.get('/api/auth/login', (req, res) => {});\n" +
                "app.post('/api/auth/register', (req, res) => {});\n";

        JavaSourceAnalysisService.AnalysisResult result = jsAnalysisService.analyzeJsFile(
                "src/controllers/auth.js", jsContent, snapshot);

        assertNotNull(result);
        assertFalse(result.nodes.isEmpty());

        // Check Directory & Module
        assertTrue(result.nodes.stream().anyMatch(n -> "DIRECTORY".equals(n.getNodeType())), "Should create directory node");
        assertTrue(result.nodes.stream().anyMatch(n -> "MODULE".equals(n.getNodeType())), "Should create module node");

        // Check Class
        assertTrue(result.nodes.stream().anyMatch(n -> "CLASS".equals(n.getNodeType()) && "AuthController".equals(n.getName())));

        // Check API Routes
        assertTrue(result.nodes.stream().anyMatch(n -> "API_ENDPOINT".equals(n.getNodeType()) && n.getName().contains("GET /api/auth/login")));
        assertTrue(result.nodes.stream().anyMatch(n -> "API_ENDPOINT".equals(n.getNodeType()) && n.getName().contains("POST /api/auth/register")));

        // Check Imports edges
        assertTrue(result.edges.stream().anyMatch(e -> "IMPORTS".equals(e.getRelationshipType())));
        // Check Exposes edges
        assertTrue(result.edges.stream().anyMatch(e -> "EXPOSES".equals(e.getRelationshipType())));
    }
}

