package com.impactmapper.service;

import com.impactmapper.config.IndexingResourceLimits;
import com.impactmapper.dto.GitHubRepoInfo;
import com.impactmapper.dto.GitTreeResult;
import com.impactmapper.entity.ArchitectureSnapshot;
import com.impactmapper.entity.Repository;
import com.impactmapper.exception.RepositoryResourceLimitExceededException;
import com.impactmapper.parser.ManifestDiscoveryService;
import com.impactmapper.repository.ArchitectureEdgeRepository;
import com.impactmapper.repository.ArchitectureNodeRepository;
import com.impactmapper.repository.ArchitectureSnapshotRepository;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class FreeTierResourceLimitTest {

    @Mock
    private GitHubService gitHubService;

    @Mock
    private ManifestDiscoveryService manifestDiscoveryService;

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private RepoDependencyRepository dependencyRepository;

    @Mock
    private ArchitectureAnalysisService architectureAnalysisService;

    @Mock
    private PlatformTransactionManager transactionManager;

    private IndexingResourceLimits resourceLimits;
    private RepoIndexingService repoIndexingService;

    @BeforeEach
    void setUp() {
        resourceLimits = new IndexingResourceLimits();
        resourceLimits.setMaxSourceFiles(150);
        resourceLimits.setMaxArchiveSizeBytes(15_728_640L); // 15 MB
        resourceLimits.setMaxFileSizeBytes(1_048_576L); // 1 MB
        resourceLimits.setMaxExtractedSizeBytes(10_485_760L); // 10 MB

        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());

        repoIndexingService = new RepoIndexingService(
                gitHubService,
                manifestDiscoveryService,
                repositoryRepository,
                dependencyRepository,
                architectureAnalysisService,
                transactionManager,
                null,
                null,
                resourceLimits
        );
    }

    @Test
    void testOversizedRepositoryRejection_SourceFilesLimit() {
        String repoUrl = "https://github.com/developer/large-monolith";
        GitHubRepoInfo info = GitHubRepoInfo.builder()
                .name("large-monolith")
                .fullName("developer/large-monolith")
                .defaultBranch("main")
                .htmlUrl(repoUrl)
                .build();
        when(gitHubService.getRepoInfo("developer", "large-monolith")).thenReturn(info);

        // Generate 155 source files (exceeds limit of 150)
        List<String> paths = new ArrayList<>();
        for (int i = 1; i <= 155; i++) {
            paths.add("src/main/java/com/app/Service" + i + ".java");
        }
        when(gitHubService.fetchFileTree("developer", "large-monolith", "main"))
                .thenReturn(new GitTreeResult("sha-123", paths));
        when(gitHubService.isAnalyzableSourceFile(anyString())).thenReturn(true);

        when(repositoryRepository.findByRepoName("developer/large-monolith")).thenReturn(Optional.empty());
        when(repositoryRepository.saveAndFlush(any(Repository.class))).thenAnswer(inv -> inv.getArgument(0));

        RepositoryResourceLimitExceededException ex = assertThrows(
                RepositoryResourceLimitExceededException.class,
                () -> repoIndexingService.indexRepository(repoUrl)
        );

        assertEquals("MAX_SOURCE_FILES", ex.getLimitType());
        assertEquals(155, ex.getActualValue());
        assertEquals(150, ex.getLimitValue());
        assertTrue(ex.getMessage().contains("exceeds free-tier limit of 150 source files"));

        // Verify semaphore permit was released
        assertEquals(0, repoIndexingService.getActiveIndexingCount(), "Indexing semaphore must be released on limit rejection");

        // Verify repository was saved with FAILED_RESOURCE_LIMIT status
        verify(repositoryRepository).saveAndFlush(argThat(repo ->
                "FAILED_RESOURCE_LIMIT".equals(repo.getIndexStatus()) &&
                        repo.getStatusDetail().contains("exceeds free-tier limit")
        ));
    }

    @Test
    void testArchiveSizeLimitExceeded_PropagatesAndReleasesSemaphore() {
        String repoUrl = "https://github.com/developer/huge-archive";
        GitHubRepoInfo info = GitHubRepoInfo.builder()
                .name("huge-archive")
                .fullName("developer/huge-archive")
                .defaultBranch("main")
                .htmlUrl(repoUrl)
                .build();
        when(gitHubService.getRepoInfo("developer", "huge-archive")).thenReturn(info);

        // 10 files (under the 150 file limit)
        List<String> paths = List.of("src/App.java");
        when(gitHubService.fetchFileTree("developer", "huge-archive", "main"))
                .thenReturn(new GitTreeResult("sha-123", paths));
        when(gitHubService.isAnalyzableSourceFile(anyString())).thenReturn(true);

        when(manifestDiscoveryService.discoverAndParse(any(), any(), any(), any(), any()))
                .thenThrow(new RepositoryResourceLimitExceededException(
                        "MAX_ARCHIVE_SIZE", 25_000_000L, 15_728_640L, "bytes",
                        "Repository archive size (23.8 MB) exceeds free-tier limit of 15.0 MB"
                ));

        RepositoryResourceLimitExceededException ex = assertThrows(
                RepositoryResourceLimitExceededException.class,
                () -> repoIndexingService.indexRepository(repoUrl)
        );

        assertEquals("MAX_ARCHIVE_SIZE", ex.getLimitType());
        assertEquals(25_000_000L, ex.getActualValue());

        // Verify semaphore permit was released
        assertEquals(0, repoIndexingService.getActiveIndexingCount(), "Indexing semaphore must be released on archive limit failure");
    }

    @Test
    void testConcurrentIndexingRejection() throws InterruptedException {
        // Simulate an in-progress indexing job by acquiring the single permit
        java.lang.reflect.Field semField;
        try {
            semField = RepoIndexingService.class.getDeclaredField("globalIndexingSemaphore");
            semField.setAccessible(true);
            java.util.concurrent.Semaphore sem = (java.util.concurrent.Semaphore) semField.get(repoIndexingService);
            assertTrue(sem.tryAcquire());

            IllegalStateException ex = assertThrows(
                    IllegalStateException.class,
                    () -> repoIndexingService.indexRepository("https://github.com/developer/repo")
            );

            assertTrue(ex.getMessage().contains("already in progress"));

            // Release
            sem.release();
            assertEquals(0, repoIndexingService.getActiveIndexingCount());
        } catch (NoSuchFieldException | IllegalAccessException e) {
            fail("Reflection failed: " + e.getMessage());
        }
    }

    @Test
    void testMemoryEndpointResponseStructure() throws Exception {
        javax.sql.DataSource mockDataSource = mock(javax.sql.DataSource.class);
        org.springframework.beans.factory.ObjectProvider<RepoIndexingService> repoIndexingProvider = mock(org.springframework.beans.factory.ObjectProvider.class);
        org.springframework.beans.factory.ObjectProvider<ArchitectureAnalysisService> archServiceProvider = mock(org.springframework.beans.factory.ObjectProvider.class);

        when(repoIndexingProvider.getIfAvailable()).thenReturn(repoIndexingService);
        when(archServiceProvider.getIfAvailable()).thenReturn(architectureAnalysisService);
        when(architectureAnalysisService.getActiveAnalysisCount()).thenReturn(0);

        com.impactmapper.controller.HealthController healthController = new com.impactmapper.controller.HealthController(
                mockDataSource,
                repoIndexingProvider,
                archServiceProvider
        );

        org.springframework.http.ResponseEntity<Map<String, Object>> response = healthController.memoryDiagnostics();
        assertNotNull(response);
        assertEquals(org.springframework.http.HttpStatus.OK, response.getStatusCode());

        Map<String, Object> body = response.getBody();
        assertNotNull(body);

        // Verify heap isolation
        assertTrue(body.containsKey("heap"));
        Map<String, Object> heap = (Map<String, Object>) body.get("heap");
        assertTrue(heap.containsKey("usedMb"));
        assertTrue(heap.containsKey("committedMb"));
        assertTrue(heap.containsKey("maxMb"));

        // Verify Metaspace metrics
        assertTrue(body.containsKey("metaspaceUsedMb"));
        assertTrue(body.containsKey("metaspaceCommittedMb"));

        // Verify GC metrics
        assertTrue(body.containsKey("garbageCollection"));
        Map<String, Object> gc = (Map<String, Object>) body.get("garbageCollection");
        assertTrue(gc.containsKey("collectionCount"));
        assertTrue(gc.containsKey("collectionTimeMs"));

        // Verify Concurrency metrics
        assertEquals(0, body.get("activeIndexingJobs"));
        assertEquals(0, body.get("activeArchitectureJobs"));

        // Verify containerRssMb key is present (even if null on non-Linux host)
        assertTrue(body.containsKey("containerRssMb"));
    }

    @Test
    void testArchitectureAnalysisFileLimitRejection() {
        org.springframework.beans.factory.ObjectProvider<IndexingResourceLimits> limitsProvider = mock(org.springframework.beans.factory.ObjectProvider.class);
        when(limitsProvider.getIfAvailable()).thenReturn(resourceLimits);

        ArchitectureSnapshotRepository mockSnapRepo = mock(ArchitectureSnapshotRepository.class);
        ArchitectureNodeRepository mockNodeRepo = mock(ArchitectureNodeRepository.class);
        ArchitectureEdgeRepository mockEdgeRepo = mock(ArchitectureEdgeRepository.class);
        JavaSourceAnalysisService mockJava = mock(JavaSourceAnalysisService.class);
        JavaScriptSourceAnalysisService mockJs = mock(JavaScriptSourceAnalysisService.class);
        org.springframework.beans.factory.ObjectProvider<CodeCityService> mockCityProvider = mock(org.springframework.beans.factory.ObjectProvider.class);

        ArchitectureAnalysisService archService = new ArchitectureAnalysisService(
                gitHubService,
                mockJava,
                mockJs,
                mockSnapRepo,
                mockNodeRepo,
                mockEdgeRepo,
                repositoryRepository,
                mockCityProvider,
                transactionManager,
                null,
                limitsProvider
        );

        Repository repo = Repository.builder().id(201L).repoName("developer/large-arch").repoUrl("https://github.com/developer/large-arch").build();

        // 160 candidate source files (exceeds limit 150)
        List<String> files = new ArrayList<>();
        for (int i = 1; i <= 160; i++) {
            files.add("src/main/java/com/example/Class" + i + ".java");
        }
        when(gitHubService.fetchFileTree("developer", "large-arch", "main"))
                .thenReturn(new GitTreeResult("sha-arch", files));

        RepositoryResourceLimitExceededException ex = assertThrows(
                RepositoryResourceLimitExceededException.class,
                () -> archService.analyzeRepositoryArchitecture(repo)
        );

        assertEquals("MAX_SOURCE_FILES", ex.getLimitType());
        assertEquals(160, ex.getActualValue());
        assertEquals(150, ex.getLimitValue());
        assertEquals(0, archService.getActiveAnalysisCount(), "Active analysis count must return to 0");
    }

    @Test
    void testArchitectureAnalysisConcurrencyRejection() throws Exception {
        org.springframework.beans.factory.ObjectProvider<IndexingResourceLimits> limitsProvider = mock(org.springframework.beans.factory.ObjectProvider.class);
        when(limitsProvider.getIfAvailable()).thenReturn(resourceLimits);

        ArchitectureSnapshotRepository mockSnapRepo = mock(ArchitectureSnapshotRepository.class);
        ArchitectureNodeRepository mockNodeRepo = mock(ArchitectureNodeRepository.class);
        ArchitectureEdgeRepository mockEdgeRepo = mock(ArchitectureEdgeRepository.class);
        JavaSourceAnalysisService mockJava = mock(JavaSourceAnalysisService.class);
        JavaScriptSourceAnalysisService mockJs = mock(JavaScriptSourceAnalysisService.class);
        org.springframework.beans.factory.ObjectProvider<CodeCityService> mockCityProvider = mock(org.springframework.beans.factory.ObjectProvider.class);

        ArchitectureAnalysisService archService = new ArchitectureAnalysisService(
                gitHubService,
                mockJava,
                mockJs,
                mockSnapRepo,
                mockNodeRepo,
                mockEdgeRepo,
                repositoryRepository,
                mockCityProvider,
                transactionManager,
                null,
                limitsProvider
        );

        Repository repo = Repository.builder().id(202L).repoName("developer/concurrent-arch").repoUrl("https://github.com/developer/concurrent-arch").build();

        // Acquire the single analysis semaphore permit via reflection
        java.lang.reflect.Field semField = ArchitectureAnalysisService.class.getDeclaredField("globalAnalysisSemaphore");
        semField.setAccessible(true);
        java.util.concurrent.Semaphore sem = (java.util.concurrent.Semaphore) semField.get(archService);
        assertTrue(sem.tryAcquire());

        try {
            IllegalStateException ex = assertThrows(
                    IllegalStateException.class,
                    () -> archService.analyzeRepositoryArchitecture(repo)
            );
            assertTrue(ex.getMessage().contains("in progress"));
        } finally {
            sem.release();
        }
    }

    @Test
    void testArchitectureAnalysisRequestDeduplication() throws Exception {
        org.springframework.beans.factory.ObjectProvider<IndexingResourceLimits> limitsProvider = mock(org.springframework.beans.factory.ObjectProvider.class);
        when(limitsProvider.getIfAvailable()).thenReturn(resourceLimits);

        ArchitectureSnapshotRepository mockSnapRepo = mock(ArchitectureSnapshotRepository.class);
        ArchitectureNodeRepository mockNodeRepo = mock(ArchitectureNodeRepository.class);
        ArchitectureEdgeRepository mockEdgeRepo = mock(ArchitectureEdgeRepository.class);
        JavaSourceAnalysisService mockJava = mock(JavaSourceAnalysisService.class);
        JavaScriptSourceAnalysisService mockJs = mock(JavaScriptSourceAnalysisService.class);
        org.springframework.beans.factory.ObjectProvider<CodeCityService> mockCityProvider = mock(org.springframework.beans.factory.ObjectProvider.class);

        ArchitectureAnalysisService archService = new ArchitectureAnalysisService(
                gitHubService,
                mockJava,
                mockJs,
                mockSnapRepo,
                mockNodeRepo,
                mockEdgeRepo,
                repositoryRepository,
                mockCityProvider,
                transactionManager,
                null,
                limitsProvider
        );

        Repository repo = Repository.builder().id(203L).repoName("developer/dedup-arch").repoUrl("https://github.com/developer/dedup-arch").build();
        ArchitectureSnapshot expectedSnapshot = ArchitectureSnapshot.builder().id(999L).repository(repo).status("ANALYZED").build();

        // Simulate an in-flight analysis future already running for repo 203L
        java.lang.reflect.Field inFlightField = ArchitectureAnalysisService.class.getDeclaredField("inFlightAnalysis");
        inFlightField.setAccessible(true);
        Map<Long, java.util.concurrent.CompletableFuture<ArchitectureSnapshot>> inFlight =
                (Map<Long, java.util.concurrent.CompletableFuture<ArchitectureSnapshot>>) inFlightField.get(archService);

        java.util.concurrent.CompletableFuture<ArchitectureSnapshot> future = java.util.concurrent.CompletableFuture.completedFuture(expectedSnapshot);
        inFlight.put(203L, future);

        // A second call should return the existing future's result without executing tree fetch or network calls
        ArchitectureSnapshot result = archService.analyzeRepositoryArchitecture(repo);
        assertSame(expectedSnapshot, result, "Deduplication must return in-flight completed snapshot");
        verifyNoInteractions(gitHubService);
    }
}
