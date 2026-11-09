package com.impactmapper.controller;

import com.impactmapper.service.ArchitectureAnalysisService;
import com.impactmapper.service.RepoIndexingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryPoolMXBean;
import java.lang.management.ThreadMXBean;
import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Production Health & Diagnostic Controller for Cloud Platforms (Render, Kubernetes, etc.)
 * Exposes lightweight, unauthenticated health probes and memory diagnostics.
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
@Slf4j
public class HealthController {

    private final DataSource dataSource;
    private final ObjectProvider<RepoIndexingService> repoIndexingServiceProvider;
    private final ObjectProvider<ArchitectureAnalysisService> architectureAnalysisServiceProvider;

    /**
     * Readiness probe: Verifies application vitality, database connectivity, and basic heap state.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "Plexus Dependency Impact Mapper");
        response.put("timestamp", Instant.now().toString());

        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();
        response.put("heapUsedMb", Math.round(usedMemory / (1024.0 * 1024.0) * 10.0) / 10.0);
        response.put("heapMaxMb", Math.round(runtime.maxMemory() / (1024.0 * 1024.0) * 10.0) / 10.0);

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
     * Liveness probe: Fast non-blocking check verifying web server is accepting traffic.
     */
    @GetMapping("/liveness")
    public ResponseEntity<Map<String, Object>> livenessCheck() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(response);
    }

    /**
     * Lightweight memory & concurrency diagnostics for container monitoring.
     */
    @GetMapping("/memory")
    public ResponseEntity<Map<String, Object>> memoryDiagnostics() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "Plexus Dependency Impact Mapper");
        response.put("timestamp", Instant.now().toString());

        Runtime runtime = Runtime.getRuntime();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;
        long maxMemory = runtime.maxMemory();

        Map<String, Object> heap = new LinkedHashMap<>();
        heap.put("usedMb", Math.round(usedMemory / (1024.0 * 1024.0) * 10.0) / 10.0);
        heap.put("committedMb", Math.round(totalMemory / (1024.0 * 1024.0) * 10.0) / 10.0);
        heap.put("maxMb", Math.round(maxMemory / (1024.0 * 1024.0) * 10.0) / 10.0);
        heap.put("usedPercent", Math.round(((double) usedMemory / maxMemory) * 1000.0) / 10.0);
        response.put("heap", heap);

        // Metaspace usage
        long metaspaceUsed = -1;
        long metaspaceCommitted = -1;
        for (MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans()) {
            if (pool.getName().contains("Metaspace")) {
                metaspaceUsed = pool.getUsage().getUsed();
                metaspaceCommitted = pool.getUsage().getCommitted();
                break;
            }
        }
        if (metaspaceUsed != -1) {
            response.put("metaspaceUsedMb", Math.round(metaspaceUsed / (1024.0 * 1024.0) * 10.0) / 10.0);
            response.put("metaspaceCommittedMb", Math.round(metaspaceCommitted / (1024.0 * 1024.0) * 10.0) / 10.0);
        }

        // Reliable Linux container RSS detection (cgroup v2 / v1 / /proc/self/status)
        Long containerRssBytes = readContainerRssBytes();
        if (containerRssBytes != null) {
            response.put("containerRssMb", Math.round(containerRssBytes / (1024.0 * 1024.0) * 10.0) / 10.0);
        } else {
            response.put("containerRssMb", null);
        }

        // Thread count
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        response.put("threadCount", threadBean.getThreadCount());
        response.put("peakThreadCount", threadBean.getPeakThreadCount());

        // Garbage collection stats
        long totalGcCount = 0;
        long totalGcTimeMs = 0;
        for (GarbageCollectorMXBean gc : ManagementFactory.getGarbageCollectorMXBeans()) {
            long count = gc.getCollectionCount();
            if (count > 0) totalGcCount += count;
            long time = gc.getCollectionTime();
            if (time > 0) totalGcTimeMs += time;
        }
        Map<String, Object> gcInfo = new LinkedHashMap<>();
        gcInfo.put("collectionCount", totalGcCount);
        gcInfo.put("collectionTimeMs", totalGcTimeMs);
        response.put("garbageCollection", gcInfo);

        // Active concurrency counters
        RepoIndexingService indexingService = repoIndexingServiceProvider.getIfAvailable();
        ArchitectureAnalysisService archService = architectureAnalysisServiceProvider.getIfAvailable();
        response.put("activeIndexingJobs", indexingService != null ? indexingService.getActiveIndexingCount() : 0);
        response.put("activeArchitectureJobs", archService != null ? archService.getActiveAnalysisCount() : 0);

        return ResponseEntity.ok(response);
    }

    private Long readContainerRssBytes() {
        // Try cgroup v2
        try {
            java.nio.file.Path p2 = java.nio.file.Paths.get("/sys/fs/cgroup/memory.current");
            if (java.nio.file.Files.exists(p2)) {
                String val = java.nio.file.Files.readString(p2).trim();
                return Long.parseLong(val);
            }
        } catch (Exception ignored) {}

        // Try cgroup v1
        try {
            java.nio.file.Path p1 = java.nio.file.Paths.get("/sys/fs/cgroup/memory/memory.usage_in_bytes");
            if (java.nio.file.Files.exists(p1)) {
                String val = java.nio.file.Files.readString(p1).trim();
                return Long.parseLong(val);
            }
        } catch (Exception ignored) {}

        // Try /proc/self/status (VmRSS line)
        try {
            java.nio.file.Path procStatus = java.nio.file.Paths.get("/proc/self/status");
            if (java.nio.file.Files.exists(procStatus)) {
                for (String line : java.nio.file.Files.readAllLines(procStatus)) {
                    if (line.startsWith("VmRSS:")) {
                        String[] parts = line.split("\\s+");
                        if (parts.length >= 2) {
                            long kb = Long.parseLong(parts[1]);
                            return kb * 1024L;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        return null;
    }
}
