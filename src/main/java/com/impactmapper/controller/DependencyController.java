package com.impactmapper.controller;

import com.impactmapper.service.DependencyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dependencies")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DependencyController {

    private final DependencyService dependencyService;

    @GetMapping
    public ResponseEntity<List<DependencyService.LibrarySummary>> getLibraries(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String consistency,
            @RequestParam(required = false) Long repoId) {
        return ResponseEntity.ok(dependencyService.getLibraries(q, type, consistency, repoId));
    }

    @GetMapping("/detail")
    public ResponseEntity<Map<String, Object>> getLibraryDetail(
            @RequestParam String artifactId,
            @RequestParam(required = false) String groupId,
            @RequestParam(required = false) String packageType) {
        Map<String, Object> detail = dependencyService.getLibraryDetail(artifactId, groupId, packageType);
        if (detail.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(detail);
    }
}

