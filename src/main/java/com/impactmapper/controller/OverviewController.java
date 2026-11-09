package com.impactmapper.controller;

import com.impactmapper.service.OverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/overview")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class OverviewController {

    private final OverviewService overviewService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getOverview() {
        return ResponseEntity.ok(overviewService.getOverviewMetrics());
    }
}

