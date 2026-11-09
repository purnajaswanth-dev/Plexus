package com.impactmapper.service;

import com.impactmapper.dto.GitHubRepoInfo;
import com.impactmapper.dto.GitTreeResult;
import com.impactmapper.dto.ParsedDep;
import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.parser.ManifestDiscoveryResult;
import com.impactmapper.parser.ManifestDiscoveryService;
import com.impactmapper.repository.RepoDependencyRepository;
import com.impactmapper.repository.RepositoryRepository;
import com.impactmapper.util.GitHubUrlParser;
import lombok.extern.slf4j.Slf4j;
import com.impactmapper.entity.AppUser;
import com.impactmapper.repository.AppUserRepository;
import com.impactmapper.security.SecurityUtils;
import com.impactmapper.security.UserPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Slf4j
public class RepoIndexingService {

    private final GitHubService gitHubService;
    private final ManifestDiscoveryService manifestDiscoveryService;
    private final RepositoryRepository repositoryRepository;
    private final RepoDependencyRepository dependencyRepository;
    private final ArchitectureAnalysisService architectureAnalysisService;
    private final TransactionTemplate transactionTemplate;
    private final AppUserRepository appUserRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    private final ConcurrentHashMap<String, Object> repoLocks = new ConcurrentHashMap<>();

    public RepoIndexingService(
            GitHubService gitHubService,
            ManifestDiscoveryService manifestDiscoveryService,
            RepositoryRepository repositoryRepository,
            RepoDependencyRepository dependencyRepository,
            ArchitectureAnalysisService architectureAnalysisService,
            PlatformTransactionManager transactionManager) {
        this(gitHubService, manifestDiscoveryService, repositoryRepository, dependencyRepository, architectureAnalysisService, transactionManager, null, null);
    }

    @Autowired
    public RepoIndexingService(
            GitHubService gitHubService,
            ManifestDiscoveryService manifestDiscoveryService,
            RepositoryRepository repositoryRepository,
            RepoDependencyRepository dependencyRepository,
            ArchitectureAnalysisService architectureAnalysisService,
            PlatformTransactionManager transactionManager,
            @Autowired(required = false) AppUserRepository appUserRepository,
            @Autowired(required = false) org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        this.gitHubService = gitHubService;
        this.manifestDiscoveryService = manifestDiscoveryService;
        this.repositoryRepository = repositoryRepository;
        this.dependencyRepository = dependencyRepository;
        this.architectureAnalysisService = architectureAnalysisService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.appUserRepository = appUserRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public Repository indexRepository(String githubUrl) {
        if (githubUrl == null || githubUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("GitHub repository URL must not be empty");
        }

        GitHubUrlParser.ParsedRepo parsed = GitHubUrlParser.parse(githubUrl);
        String owner = parsed.getOwner();
        String repoName = parsed.getRepo();
        String repoKey = parsed.getFullName().toLowerCase();

        Object lock = repoLocks.computeIfAbsent(repoKey, k -> new Object());
        synchronized (lock) {
            log.info("Indexing repository: {} (canonical: {})", parsed.getFullName(), parsed.getCanonicalUrl());

            // 1. Fetch metadata outside DB transaction
            GitHubRepoInfo info = gitHubService.getRepoInfo(owner, repoName);
            if (info == null) {
                throw new RepoNotFoundException("Repository not found on GitHub: " + parsed.getFullName());
            }

            String branch = (info.getDefaultBranch() != null && !info.getDefaultBranch().isBlank())
                    ? info.getDefaultBranch()
                    : "main";

            // 2. Fetch Git repository tree
            GitTreeResult treeResult = gitHubService.fetchFileTree(owner, repoName, branch);
            List<String> treePaths = treeResult.getFilePaths();
            String commitSha = treeResult.getCommitSha();
            int totalFiles = treePaths != null ? treePaths.size() : 0;

            // 3. Manifest Discovery and parsing
            ManifestDiscoveryResult discoveryResult = manifestDiscoveryService.discoverAndParse(
                    gitHubService, owner, repoName, branch, treePaths);

            List<ParsedDep> parsedDeps = discoveryResult.getAllDependencies();
            boolean hasManifests = discoveryResult.isHasManifests();
            boolean isMonorepo = discoveryResult.isMonorepo();
            String primaryEcosystem = discoveryResult.getPrimaryEcosystem();

            String indexStatus;
            String statusDetail;
            if (hasManifests) {
                indexStatus = "INDEXED";
                statusDetail = String.format("Indexed %d file(s). Discovered %d manifest(s) with %d dependencies (%s).",
                        totalFiles,
                        discoveryResult.getManifestPaths().size(),
                        parsedDeps.size(),
                        String.join(", ", discoveryResult.getEcosystems()));
            } else {
                indexStatus = "INDEXED_NO_MANIFEST";
                statusDetail = String.format("Indexed %d file(s). No supported package manifests found (checked Maven, Gradle, npm, Python, Go).",
                        totalFiles);
            }

            // Resolve authenticated or legacy system owner
            AppUser appUser = null;
            if (appUserRepository != null) {
                Optional<UserPrincipal> userPrincipalOpt = SecurityUtils.getCurrentUser();
                if (userPrincipalOpt.isPresent()) {
                    appUser = appUserRepository.findById(userPrincipalOpt.get().getAppUserId()).orElse(null);
                } else {
                    appUser = appUserRepository.findById(UUID.fromString("00000000-0000-0000-0000-000000000001")).orElse(null);
                }
            }
            final AppUser finalOwner = appUser;

            // 4. Atomic Database Update inside explicit TransactionTemplate
            Repository repository = transactionTemplate.execute(status -> {
                Repository repo;
                if (finalOwner != null) {
                    repo = repositoryRepository.findByOwnerIdAndRepoName(finalOwner.getId(), info.getFullName())
                            .orElseGet(() -> Repository.builder().owner(finalOwner).repoName(info.getFullName()).build());
                    repo.setOwner(finalOwner);
                } else {
                    repo = repositoryRepository.findByRepoName(info.getFullName())
                            .orElseGet(() -> Repository.builder().repoName(info.getFullName()).build());
                }

                repo.setRepoUrl(info.getHtmlUrl());
                repo.setDefaultBranch(branch);
                repo.setDescription(info.getDescription());
                repo.setLanguage(info.getLanguage());
                repo.setCommitSha(commitSha);
                repo.setTotalFilesDiscovered(totalFiles);
                repo.setIsMonorepo(isMonorepo);
                repo.setDependencyFileType(primaryEcosystem);
                repo.setIndexStatus(indexStatus);
                repo.setStatusDetail(statusDetail);
                repo.setLastIndexed(LocalDateTime.now());

                Repository savedRepo = repositoryRepository.saveAndFlush(repo);

                // Safe JPQL bulk delete: clears L1 cache and flushes
                dependencyRepository.deleteByRepositoryId(savedRepo.getId());

                if (parsedDeps != null && !parsedDeps.isEmpty()) {
                    if (jdbcTemplate != null) {
                        String insertSql = "INSERT INTO repo_dependencies (repo_id, group_id, artifact_id, version, scope, is_dev, package_type, manifest_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                        jdbcTemplate.batchUpdate(insertSql, parsedDeps, 100, (ps, dep) -> {
                            ps.setLong(1, savedRepo.getId());
                            ps.setString(2, dep.getGroupId());
                            ps.setString(3, dep.getArtifactId());
                            ps.setString(4, dep.getVersion());
                            ps.setString(5, dep.getScope());
                            ps.setBoolean(6, dep.isDev());
                            ps.setString(7, dep.getPackageType());
                            ps.setString(8, dep.getManifestPath());
                        });
                    } else {
                        List<RepoDependency> entities = parsedDeps.stream()
                                .map(dep -> RepoDependency.builder()
                                        .repository(savedRepo)
                                        .groupId(dep.getGroupId())
                                        .artifactId(dep.getArtifactId())
                                        .version(dep.getVersion())
                                        .scope(dep.getScope())
                                        .isDev(dep.isDev())
                                        .packageType(dep.getPackageType())
                                        .manifestPath(dep.getManifestPath())
                                        .build())
                                .collect(Collectors.toList());

                        dependencyRepository.saveAllAndFlush(entities);
                    }
                }

                return savedRepo;
            });

            // 5. Post-commit Architecture Analysis
            // Analyzes source code architecture for BOTH INDEXED and INDEXED_NO_MANIFEST
            if (repository != null) {
                try {
                    log.info("Triggering architecture analysis for {}...", repository.getRepoName());
                    architectureAnalysisService.analyzeRepositoryArchitecture(repository);
                } catch (Exception e) {
                    log.warn("Architecture analysis skipped for {}: {}", repository.getRepoName(), e.getMessage());
                }
            }

            return repository;
        }
    }

    public void reindexAll() {
        List<Repository> all = SecurityUtils.getCurrentUser()
                .map(u -> repositoryRepository.findByOwnerIdOrderByAddedAtDesc(u.getAppUserId()))
                .orElseGet(repositoryRepository::findAll);
        for (Repository repo : all) {
            try {
                log.info("Re-indexing {}...", repo.getRepoName());
                indexRepository(repo.getRepoUrl());
                log.info("Done re-indexing {}", repo.getRepoName());
            } catch (Exception e) {
                log.error("Failed to re-index {}: {}", repo.getRepoName(), e.getMessage());
            }
        }
    }
}
