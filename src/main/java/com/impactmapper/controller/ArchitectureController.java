package com.impactmapper.controller;

import com.impactmapper.entity.ArchitectureSnapshot;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.repository.RepositoryRepository;
import com.impactmapper.security.SecurityUtils;
import com.impactmapper.service.ArchitectureAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/repos/{id}/architecture")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ArchitectureController {

    private final ArchitectureAnalysisService architectureAnalysisService;
    private final RepositoryRepository repositoryRepository;

    private void validateRepoOwnership(Long id) {
        if (id == null) return;
        SecurityUtils.getCurrentUser().ifPresent(user -> {
            if (!repositoryRepository.existsByIdAndOwnerId(id, user.getAppUserId())) {
                throw new RepoNotFoundException("Repository not found with ID: " + id);
            }
        });
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getArchitecture(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "3") Integer level) {
        validateRepoOwnership(id);
        Map<String, Object> graph = architectureAnalysisService.getArchitectureGraph(id, level);
        return ResponseEntity.ok(graph);
    }

    @PostMapping("/reindex")
    public ResponseEntity<Map<String, Object>> reindexArchitecture(@PathVariable Long id) {
        validateRepoOwnership(id);
        ArchitectureSnapshot snapshot = architectureAnalysisService.analyzeRepositoryArchitecture(id);
        if (snapshot == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Failed to analyze architecture. Check repository status and tree."));
        }
        return ResponseEntity.ok(architectureAnalysisService.getArchitectureGraph(id, 3));
    }
}

