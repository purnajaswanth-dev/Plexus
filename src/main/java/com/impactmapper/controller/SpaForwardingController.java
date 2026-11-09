package com.impactmapper.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Controller providing Single Page Application (SPA) client-side route fallback.
 * Explicitly forwards known frontend routes to index.html without intercepting /api/**
 * or static resource requests.
 */
@Controller
public class SpaForwardingController {

    @GetMapping(value = {
            "/overview",
            "/repositories",
            "/explorer",
            "/impact",
            "/network",
            "/settings",
            "/codecity",
            "/codecity/**",
            "/architecture",
            "/architecture/**"
    })
    public String forwardSpaRoutes() {
        return "forward:/index.html";
    }
}

