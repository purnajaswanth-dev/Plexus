package com.impactmapper.service;

import com.impactmapper.dto.GitHubRepoInfo;
import com.impactmapper.dto.GitTreeResult;
import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.exception.GitHubApiException;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.parser.ManifestDiscoveryResult;
import com.impactmapper.parser.ManifestDiscoveryService;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RepoIndexingServiceTest {

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

    @Mock
    private TransactionStatus transactionStatus;

    private RepoIndexingService indexingService;

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);
        indexingService = new RepoIndexingService(
                gitHubService,
                manifestDiscoveryService,
                repositoryRepository,
                dependencyRepository,
                architectureAnalysisService,
                transactionManager
        );
    }

    // Scenario 8: Repository with missing manifest file (verifying INDEXED_NO_MANIFEST and 0 dependencies)
    @Test
    void testScenario8_RepositoryWithMissingManifestTransitionsToIndexedNoManifest() {
        String repoUrl = "https://github.com/developer/docs-only";
        GitHubRepoInfo info = GitHubRepoInfo.builder()
                .fullName("developer/docs-only")
                .htmlUrl(repoUrl)
                .defaultBranch("main")
                .language("Markdown")
                .build();

        when(gitHubService.getRepoInfo("developer", "docs-only")).thenReturn(info);
        when(gitHubService.fetchFileTree("developer", "docs-only", "main"))
                .thenReturn(new GitTreeResult("abc1234", List.of("README.md", "docs/index.md", "LICENSE")));

        ManifestDiscoveryResult emptyResult = ManifestDiscoveryResult.builder()
                .allDependencies(Collections.emptyList())
                .hasManifests(false)
                .isMonorepo(false)
                .primaryEcosystem("NONE")
                .build();

        when(manifestDiscoveryService.discoverAndParse(any(), eq("developer"), eq("docs-only"), eq("main"), anyList()))
                .thenReturn(emptyResult);

        when(repositoryRepository.findByRepoName("developer/docs-only")).thenReturn(Optional.empty());
        when(repositoryRepository.saveAndFlush(any(Repository.class))).thenAnswer(invocation -> {
            Repository r = invocation.getArgument(0);
            r.setId(10L);
            return r;
        });

        Repository result = indexingService.indexRepository(repoUrl);

        assertNotNull(result);
        assertEquals("INDEXED_NO_MANIFEST", result.getIndexStatus());
        assertEquals("NONE", result.getDependencyFileType());
        assertTrue(result.getStatusDetail().contains("No supported package manifests found"));

        // Verify dependencies were cleared, but none saved
        verify(dependencyRepository).deleteByRepositoryId(10L);
        verify(dependencyRepository, never()).saveAllAndFlush(anyList());
    }

    // Scenario 10: GitHub API 404 (non-existent repository, e.g. Aethersvg)
    @Test
    void testScenario10_NonExistentRepoThrowsRepoNotFoundException() {
        String nonExistentUrl = "https://github.com/purnajaswanth-dev/Aethersvg";
        when(gitHubService.getRepoInfo("purnajaswanth-dev", "Aethersvg"))
                .thenThrow(new RepoNotFoundException("Repository not found on GitHub: purnajaswanth-dev/Aethersvg"));

        RepoNotFoundException ex = assertThrows(RepoNotFoundException.class, () ->
                indexingService.indexRepository(nonExistentUrl)
        );

        assertTrue(ex.getMessage().contains("purnajaswanth-dev/Aethersvg"));
        // Ensure no database save occurred
        verify(repositoryRepository, never()).saveAndFlush(any());
    }

    // Scenario 11: GitHub API 403 (rate limiting)
    @Test
    void testScenario11_RateLimitExceededThrowsGitHubApiException() {
        String repoUrl = "https://github.com/owner/repo";
        when(gitHubService.getRepoInfo("owner", "repo"))
                .thenThrow(new GitHubApiException("GitHub API rate limit exceeded. Please wait or configure GITHUB_TOKEN."));

        GitHubApiException ex = assertThrows(GitHubApiException.class, () ->
                indexingService.indexRepository(repoUrl)
        );

        assertTrue(ex.getMessage().contains("rate limit"));
    }

    // Scenario 12: GitHub API 401 (invalid credentials)
    @Test
    void testScenario12_InvalidCredentialsThrowsGitHubApiException() {
        String repoUrl = "https://github.com/owner/repo";
        when(gitHubService.getRepoInfo("owner", "repo"))
                .thenThrow(new GitHubApiException("GitHub API authentication failed (401 Bad credentials)."));

        GitHubApiException ex = assertThrows(GitHubApiException.class, () ->
                indexingService.indexRepository(repoUrl)
        );

        assertTrue(ex.getMessage().contains("401"));
    }

    // Scenario 13: Repository with no manifest still generates architecture graph
    @Test
    void testScenario13_RepoWithNoManifestStillTriggersArchitectureAnalysis() {
        String repoUrl = "https://github.com/developer/pure-code";
        GitHubRepoInfo info = GitHubRepoInfo.builder()
                .fullName("developer/pure-code")
                .htmlUrl(repoUrl)
                .defaultBranch("main")
                .language("Java")
                .build();

        when(gitHubService.getRepoInfo("developer", "pure-code")).thenReturn(info);
        when(gitHubService.fetchFileTree("developer", "pure-code", "main"))
                .thenReturn(new GitTreeResult("def5678", List.of("src/Main.java", "src/Utils.java")));

        ManifestDiscoveryResult emptyResult = ManifestDiscoveryResult.builder()
                .allDependencies(Collections.emptyList())
                .hasManifests(false)
                .isMonorepo(false)
                .primaryEcosystem("NONE")
                .build();

        when(manifestDiscoveryService.discoverAndParse(any(), eq("developer"), eq("pure-code"), eq("main"), anyList()))
                .thenReturn(emptyResult);

        when(repositoryRepository.findByRepoName("developer/pure-code")).thenReturn(Optional.empty());
        when(repositoryRepository.saveAndFlush(any(Repository.class))).thenAnswer(invocation -> {
            Repository r = invocation.getArgument(0);
            r.setId(20L);
            return r;
        });

        Repository result = indexingService.indexRepository(repoUrl);

        assertEquals("INDEXED_NO_MANIFEST", result.getIndexStatus());
        // Verify architecture analysis was still triggered!
        verify(architectureAnalysisService, times(1)).analyzeRepositoryArchitecture(result);
    }
}
