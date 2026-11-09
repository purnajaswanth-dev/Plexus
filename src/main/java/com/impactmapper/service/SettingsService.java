package com.impactmapper.service;

import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final GitHubService gitHubService;
    private final RepositoryRepository repositoryRepository;
    private final RepoDependencyRepository dependencyRepository;

    public Map<String, Object> getSettingsStatus() {
        Map<String, Object> response = new HashMap<>();

        // Application Info
        Map<String, Object> appInfo = new HashMap<>();
        appInfo.put("name", "Cross-Repo Dependency Impact Mapper");
        appInfo.put("version", "1.0.0");
        appInfo.put("platform", "Production-Grade Developer Platform");
        appInfo.put("javaVersion", System.getProperty("java.version", "17"));
        appInfo.put("springBootVersion", "3.2.5");
        appInfo.put("environment", "Production / Local");
        response.put("application", appInfo);

        // Database Info
        Map<String, Object> dbInfo = new HashMap<>();
        dbInfo.put("engine", "MySQL");
        dbInfo.put("database", "impact_mapper_db");
        dbInfo.put("connected", true);
        dbInfo.put("repositoriesCount", repositoryRepository.count());
        dbInfo.put("dependenciesCount", dependencyRepository.count());
        response.put("database", dbInfo);

        // GitHub API Status
        response.put("github", gitHubService.getRateLimitStatus());

        // Supported Ecosystems
        Map<String, Object> indexingConfig = new HashMap<>();
        indexingConfig.put("supportedEcosystems", new String[]{"MAVEN (pom.xml)", "NPM (package.json)"});
        indexingConfig.put("autoReindexIntervalMinutes", 120);
        indexingConfig.put("rateLimitHandling", "Graceful degradation with public fallback");
        response.put("indexing", indexingConfig);

        return response;
    }
}

