package com.impactmapper.controller;

import com.impactmapper.dto.ImpactAnalysisResult;
import com.impactmapper.dto.ImpactFinding;
import com.impactmapper.entity.RepoDependency;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.service.ImpactAnalysisService;
import com.impactmapper.service.PdfReportGeneratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/impact")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ImpactController {

    private final ImpactAnalysisService impactAnalysisService;
    private final RepoDependencyRepository dependencyRepository;
    private final PdfReportGeneratorService pdfReportGeneratorService;

    @PostMapping("/analyze")
    public ResponseEntity<ImpactAnalysisResult> analyzeImpact(@RequestBody Map<String, String> request) {
        String groupId = request != null ? request.get("groupId") : null;
        String artifactId = request != null ? request.get("artifactId") : null;
        if (artifactId == null || artifactId.isBlank()) {
            artifactId = request != null ? request.get("libraryName") : null;
        }
        if (artifactId == null || artifactId.isBlank()) {
            artifactId = request != null ? request.get("name") : null;
        }
        if (artifactId != null && artifactId.contains(":") && (groupId == null || groupId.isBlank())) {
            String[] parts = artifactId.split(":", 2);
            groupId = parts[0].trim();
            artifactId = parts[1].trim();
        }

        String fromVersion = request != null ? request.get("fromVersion") : null;
        String toVersion = request != null ? request.get("toVersion") : null;
        if (toVersion == null || toVersion.isBlank()) {
            toVersion = request != null ? request.get("targetVersion") : null;
        }

        if (artifactId == null || artifactId.trim().isEmpty()) {
            throw new IllegalArgumentException("Artifact/Library name (artifactId) is required for impact analysis");
        }
        if (toVersion == null || toVersion.trim().isEmpty()) {
            throw new IllegalArgumentException("Target version (toVersion) is required for impact analysis");
        }

        ImpactAnalysisResult result = impactAnalysisService.analyzeImpact(groupId, artifactId.trim(), fromVersion, toVersion.trim());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/report/pdf")
    public ResponseEntity<byte[]> generatePdfReportPost(@RequestBody Map<String, String> request) {
        String groupId = request.get("groupId");
        String artifactId = request.get("artifactId");
        String fromVersion = request.get("fromVersion");
        String toVersion = request.get("toVersion");

        return createPdfResponse(groupId, artifactId, fromVersion, toVersion);
    }

    @GetMapping("/report/pdf")
    public ResponseEntity<byte[]> generatePdfReportGet(
            @RequestParam(required = false) String groupId,
            @RequestParam String artifactId,
            @RequestParam(required = false) String fromVersion,
            @RequestParam String toVersion) {
        return createPdfResponse(groupId, artifactId, fromVersion, toVersion);
    }

    private ResponseEntity<byte[]> createPdfResponse(String groupId, String artifactId, String fromVersion, String toVersion) {
        if (artifactId == null || artifactId.trim().isEmpty()) {
            throw new IllegalArgumentException("Artifact/Library name is required for report generation");
        }
        if (toVersion == null || toVersion.trim().isEmpty()) {
            throw new IllegalArgumentException("Target version is required for report generation");
        }

        ImpactAnalysisResult result = impactAnalysisService.analyzeImpact(groupId, artifactId, fromVersion, toVersion);
        byte[] pdfBytes = pdfReportGeneratorService.generateImpactReportPdf(result);

        String cleanName = artifactId.replaceAll("[^a-zA-Z0-9_-]", "_");
        String filename = String.format("dependency-impact-%s-%s-%s.pdf", cleanName, toVersion, LocalDate.now());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(pdfBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(pdfBytes);
    }

    @GetMapping("/findings")
    public ResponseEntity<List<ImpactFinding>> getFindings(
            @RequestParam(required = false) String groupId,
            @RequestParam String artifactId,
            @RequestParam(required = false) String fromVersion,
            @RequestParam String toVersion) {
        ImpactAnalysisResult result = impactAnalysisService.analyzeImpact(groupId, artifactId, fromVersion, toVersion);
        return ResponseEntity.ok(result.getFindings());
    }

    @GetMapping("/library/{artifactId}")
    public List<Map<String, Object>> searchLibrary(@PathVariable String artifactId) {
        List<RepoDependency> deps = dependencyRepository.findByArtifactIdContainingIgnoreCase(artifactId);
        return deps.stream().map(d -> {
            Map<String, Object> res = new HashMap<>();
            res.put("repoId", d.getRepository() != null ? d.getRepository().getId() : null);
            res.put("repoName", d.getRepository() != null ? d.getRepository().getRepoName() : "Unknown");
            res.put("repoUrl", d.getRepository() != null ? d.getRepository().getRepoUrl() : "");
            res.put("version", d.getVersion());
            res.put("groupId", d.getGroupId());
            res.put("artifactId", d.getArtifactId());
            res.put("scope", d.getScope());
            res.put("packageType", d.getPackageType());
            return res;
        }).collect(Collectors.toList());
    }
}
