package com.impactmapper.controller;

import com.impactmapper.service.ArchitectureAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/architecture")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ArchitectureGlobalController {

    private final ArchitectureAnalysisService architectureAnalysisService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(architectureAnalysisService.getArchitectureStatus());
    }

    @PostMapping("/backfill")
    public ResponseEntity<Map<String, Object>> runBackfill(@RequestBody(required = false) Map<String, List<Long>> body) {
        List<Long> repoIds = body != null ? body.get("repoIds") : null;
        return ResponseEntity.ok(architectureAnalysisService.backfillArchitecture(repoIds));
    }
}

