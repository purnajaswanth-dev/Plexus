package com.impactmapper.config;

import com.impactmapper.repository.RepositoryRepository;
import com.impactmapper.service.RepoIndexingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final RepoIndexingService indexingService;
    private final RepositoryRepository repositoryRepository;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        long currentCount = repositoryRepository.count();
        if (currentCount > 0) {
            log.info("Database already contains {} repository records. Skipping initial repository indexing.", currentCount);
            return;
        }

        log.info("Empty database detected. Initializing starter repositories...");
        String[] repos = {
            "https://github.com/spring-projects/spring-petclinic",
            "https://github.com/iluwatar/java-design-patterns",
            "https://github.com/eugenp/tutorials"
        };

        for (String url : repos) {
            try {
                log.info("Indexing {}...", url);
                indexingService.indexRepository(url);
                log.info("Done indexing {}", url);
            } catch (Exception e) {
                log.warn("Failed to index {} on startup: {}. This might be due to GitHub rate limits.", url, e.getMessage());
            }
        }
    }
}
