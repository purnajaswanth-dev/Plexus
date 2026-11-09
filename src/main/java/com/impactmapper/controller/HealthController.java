package com.impactmapper.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Production Health Check Controller for Cloud Platforms (Render, Kubernetes, etc.)
 * Exposes lightweight, unauthenticated health probes that do not depend on external APIs (e.g. GitHub).
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
@Slf4j
public class HealthController {

    private final DataSource dataSource;

    /**
     * Readiness probe: Verifies application vitality and database connectivity.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "Plexus Dependency Impact Mapper");
        response.put("timestamp", Instant.now().toString());

        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(2);
            if (valid) {
                response.put("status", "UP");
                response.put("database", "CONNECTED");
                return ResponseEntity.ok(response);
            } else {
                response.put("status", "DOWN");
                response.put("database", "DISCONNECTED");
                response.put("error", "Database connection validation returned false");
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
            }
        } catch (Exception e) {
            log.warn("Health check database probe failed: {}", e.getMessage());
            response.put("status", "DOWN");
            response.put("database", "DISCONNECTED");
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }

    /**
     * Liveness probe: Verifies web server is running and accepting HTTP requests.
     */
    @GetMapping("/liveness")
    public ResponseEntity<Map<String, Object>> livenessCheck() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(response);
    }
}

