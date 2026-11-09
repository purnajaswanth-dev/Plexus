package com.impactmapper.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${supabase.url:${VITE_SUPABASE_URL:}}")
    private String supabaseUrl;

    @Value("${supabase.publishable-key:${VITE_SUPABASE_PUBLISHABLE_KEY:}}")
    private String supabasePublishableKey;

    @GetMapping("/config")
    public ResponseEntity<Map<String, String>> getAuthConfig() {
        Map<String, String> config = new HashMap<>();
        config.put("supabaseUrl", supabaseUrl);
        config.put("supabasePublishableKey", supabasePublishableKey);
        return ResponseEntity.ok(config);
    }
}

