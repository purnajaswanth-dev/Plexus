package com.impactmapper.service;

import com.impactmapper.config.IndexingResourceLimits;
import com.impactmapper.dto.GitHubRepoInfo;
import com.impactmapper.exception.GitHubApiException;
import com.impactmapper.exception.RepoNotFoundException;
import com.impactmapper.exception.RepositoryResourceLimitExceededException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
@Slf4j
public class GitHubService {

    @Value("${github.token:}")
    private String githubToken;

    private final IndexingResourceLimits resourceLimits;
    private final RestTemplate restTemplate = new RestTemplate();

    public GitHubService(@Autowired(required = false) IndexingResourceLimits resourceLimits) {
        this.resourceLimits = resourceLimits != null ? resourceLimits : new IndexingResourceLimits();
    }

    private HttpHeaders buildHeaders(boolean withAuth) {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        headers.set("User-Agent", "Impact-Mapper-App");

        if (withAuth && githubToken != null && !githubToken.isBlank()) {
            headers.setBearerAuth(githubToken.trim());
        }
        return headers;
    }

    public boolean hasConfiguredToken() {
        return githubToken != null && !githubToken.isBlank();
    }

    public GitHubRepoInfo getRepoInfo(String owner, String repoName) {
        String url = String.format("https://api.github.com/repos/%s/%s", owner, repoName);

        try {
            return executeGetRepoInfo(url, hasConfiguredToken());
        } catch (HttpClientErrorException.Unauthorized e) {
            log.warn("GitHub token unauthorized (401), retrying unauthenticated for public repository...");
            return executeGetRepoInfo(url, false);
        }
    }

    private GitHubRepoInfo executeGetRepoInfo(String url, boolean withAuth) {
        try {
            HttpEntity<String> entity = new HttpEntity<>(buildHeaders(withAuth));
            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, entity, JsonNode.class);

            JsonNode body = response.getBody();
            if (body == null) throw new GitHubApiException("Empty response from GitHub");

            return GitHubRepoInfo.builder()
                    .name(body.path("name").asText())
                    .fullName(body.path("full_name").asText())
                    .description(body.path("description").asText(""))
                    .defaultBranch(body.path("default_branch").asText("main"))
                    .language(body.path("language").asText("Unknown"))
                    .htmlUrl(body.path("html_url").asText(url))
                    .build();

        } catch (HttpClientErrorException.NotFound e) {
            String repoPath = url.replace("https://api.github.com/repos/", "");
            throw new RepoNotFoundException("Repository '" + repoPath + "' not found on GitHub (404). Please verify that the repository exists and is public.");
        } catch (HttpClientErrorException.Forbidden e) {
            throw new GitHubApiException("GitHub API rate limit exceeded or access forbidden (403)");
        } catch (HttpClientErrorException.Unauthorized e) {
            throw e; // rethrow so caller can retry unauthenticated
        } catch (Exception e) {
            throw new GitHubApiException("Failed to fetch repository information: " + e.getMessage());
        }
    }

    public String fetchFileContent(String owner, String repoName, String branch, String filePath) {
        String url = String.format(
                "https://api.github.com/repos/%s/%s/contents/%s?ref=%s",
                owner, repoName, filePath, branch
        );

        try {
            return executeFetchFile(url, hasConfiguredToken());
        } catch (HttpClientErrorException.Unauthorized e) {
            log.warn("GitHub token unauthorized (401), retrying file fetch unauthenticated...");
            return executeFetchFile(url, false);
        }
    }

    private String executeFetchFile(String url, boolean withAuth) {
        try {
            HttpEntity<String> entity = new HttpEntity<>(buildHeaders(withAuth));
            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, entity, JsonNode.class);

            JsonNode body = response.getBody();
            if (body == null || !body.has("content")) return null;

            String encoded = body.get("content").asText().replaceAll("\\s", "");
            byte[] decoded = Base64.getDecoder().decode(encoded);

            return new String(decoded, StandardCharsets.UTF_8);

        } catch (HttpClientErrorException.NotFound e) {
            return null;
        } catch (HttpClientErrorException.Unauthorized e) {
            throw e;
        } catch (Exception e) {
            log.warn("Failed to fetch file from {}: {}", url, e.getMessage());
            return null;
        }
    }

    public boolean fileExists(String owner, String repoName, String branch, String filePath) {
        String url = String.format(
                "https://api.github.com/repos/%s/%s/contents/%s?ref=%s",
                owner, repoName, filePath, branch
        );

        try {
            HttpEntity<String> entity = new HttpEntity<>(buildHeaders(hasConfiguredToken()));
            restTemplate.exchange(url, HttpMethod.GET, entity, JsonNode.class);
            return true;
        } catch (HttpClientErrorException.Unauthorized e) {
            try {
                HttpEntity<String> fallbackEntity = new HttpEntity<>(buildHeaders(false));
                restTemplate.exchange(url, HttpMethod.GET, fallbackEntity, JsonNode.class);
                return true;
            } catch (Exception ex) {
                return false;
            }
        } catch (HttpClientErrorException.NotFound e) {
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    public Map<String, Object> getRateLimitStatus() {
        Map<String, Object> result = new HashMap<>();
        String url = "https://api.github.com/rate_limit";

        boolean hasToken = hasConfiguredToken();
        result.put("tokenConfigured", hasToken);

        try {
            HttpEntity<String> entity = new HttpEntity<>(buildHeaders(hasToken));
            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, entity, JsonNode.class);

            JsonNode body = response.getBody();
            if (body != null && body.has("rate")) {
                JsonNode rate = body.get("rate");
                int limit = rate.path("limit").asInt(60);
                int remaining = rate.path("remaining").asInt(0);
                long resetEpoch = rate.path("reset").asLong(0);

                LocalDateTime resetTime = LocalDateTime.ofInstant(
                        Instant.ofEpochSecond(resetEpoch),
                        ZoneId.systemDefault()
                );

                result.put("status", remaining > 0 ? "OPERATIONAL" : "RATE_LIMITED");
                result.put("authenticated", hasToken && limit > 60);
                result.put("limit", limit);
                result.put("remaining", remaining);
                result.put("resetTime", resetTime.toString());
                result.put("message", "GitHub API connected successfully");
                return result;
            }
        } catch (HttpClientErrorException.Unauthorized e) {
            // Token is invalid, try unauthenticated
            result.put("tokenValid", false);
            try {
                HttpEntity<String> fallback = new HttpEntity<>(buildHeaders(false));
                ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, fallback, JsonNode.class);
                JsonNode body = response.getBody();
                if (body != null && body.has("rate")) {
                    JsonNode rate = body.get("rate");
                    result.put("status", "UNAUTHENTICATED_FALLBACK");
                    result.put("authenticated", false);
                    result.put("limit", rate.path("limit").asInt(60));
                    result.put("remaining", rate.path("remaining").asInt(0));
                    long resetEpoch = rate.path("reset").asLong(0);
                    result.put("resetTime", LocalDateTime.ofInstant(Instant.ofEpochSecond(resetEpoch), ZoneId.systemDefault()).toString());
                    result.put("message", "Configured token returned 401; falling back to unauthenticated public mode (60 req/hr)");
                    return result;
                }
            } catch (Exception ex) {
                // fall through
            }
        } catch (Exception e) {
            log.warn("Could not query GitHub rate limit: {}", e.getMessage());
        }

        result.put("status", "UNAVAILABLE");
        result.put("authenticated", false);
        result.put("limit", 60);
        result.put("remaining", 0);
        result.put("message", "Unable to reach GitHub API rate limit endpoint");
        return result;
    }

    public com.impactmapper.dto.GitTreeResult fetchFileTree(String owner, String repoName, String branch) {
        String url = String.format("https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1", owner, repoName, branch);

        try {
            return executeFetchFileTree(url, hasConfiguredToken());
        } catch (HttpClientErrorException.Unauthorized e) {
            log.warn("GitHub token unauthorized (401), retrying file tree fetch unauthenticated...");
            return executeFetchFileTree(url, false);
        } catch (Exception e) {
            log.warn("Failed to fetch recursive file tree for {}/{}: {}", owner, repoName, e.getMessage());
            return new com.impactmapper.dto.GitTreeResult("unknown", Collections.emptyList());
        }
    }

    private com.impactmapper.dto.GitTreeResult executeFetchFileTree(String url, boolean withAuth) {
        try {
            HttpEntity<String> entity = new HttpEntity<>(buildHeaders(withAuth));
            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.GET, entity, JsonNode.class);

            JsonNode body = response.getBody();
            if (body == null) {
                return new com.impactmapper.dto.GitTreeResult("unknown", Collections.emptyList());
            }

            String sha = body.path("sha").asText("HEAD");
            boolean truncated = body.path("truncated").asBoolean(false);
            if (truncated) {
                log.warn("Git tree for {} was truncated by GitHub (>65,536 items). Indexing discovered subset.", url);
            }
            List<String> paths = new ArrayList<>();

            if (body.has("tree") && body.get("tree").isArray()) {
                for (JsonNode item : body.get("tree")) {
                    String type = item.path("type").asText();
                    String path = item.path("path").asText();
                    if ("blob".equalsIgnoreCase(type) && !path.isBlank()) {
                        paths.add(path);
                    }
                }
            }
            return new com.impactmapper.dto.GitTreeResult(sha, paths, truncated);
        } catch (HttpClientErrorException.Unauthorized e) {
            throw e;
        } catch (Exception e) {
            log.warn("File tree request error: {}", e.getMessage());
            return new com.impactmapper.dto.GitTreeResult("unknown", Collections.emptyList());
        }
    }

    /**
     * Downloads the entire repository as a single ZIP archive and extracts all analyzable source files
     * into an in-memory map of { relativeFilePath -> content }.
     * This avoids hundreds of sequential GitHub API calls, avoids hitting the GitHub rate limit,
     * and reduces indexing time from minutes to 2-3 seconds.
     */
    public Map<String, String> downloadRepositoryArchive(String owner, String repoName, String branch) {
        String url = String.format("https://api.github.com/repos/%s/%s/zipball/%s", owner, repoName, branch);
        try {
            Map<String, String> files = executeDownloadArchive(url, hasConfiguredToken());
            if (files != null && !files.isEmpty()) {
                return files;
            }
        } catch (RepositoryResourceLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Authenticated zipball download failed for {}/{}: {}. Retrying unauthenticated...", owner, repoName, e.getMessage());
            try {
                Map<String, String> files = executeDownloadArchive(url, false);
                if (files != null && !files.isEmpty()) {
                    return files;
                }
            } catch (RepositoryResourceLimitExceededException eLimit) {
                throw eLimit;
            } catch (Exception ex) {
                log.warn("Unauthenticated zipball download failed for {}/{}: {}", owner, repoName, ex.getMessage());
            }
        }
        return Collections.emptyMap();
    }

    private Map<String, String> executeDownloadArchive(String url, boolean withAuth) throws Exception {
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(15))
                .build();

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", "Impact-Mapper-App")
                .header("Accept", "application/vnd.github+json")
                .timeout(Duration.ofSeconds(60));

        if (withAuth && githubToken != null && !githubToken.isBlank()) {
            reqBuilder.header("Authorization", "Bearer " + githubToken.trim());
        }

        HttpResponse<InputStream> response = client.send(
                reqBuilder.build(),
                HttpResponse.BodyHandlers.ofInputStream()
        );

        if (response.statusCode() == 401 || response.statusCode() == 403) {
            throw new IllegalStateException("GitHub archive download returned HTTP " + response.statusCode());
        }
        if (response.statusCode() != 200) {
            log.warn("GitHub archive download returned HTTP {}: {}", response.statusCode(), url);
            return Collections.emptyMap();
        }

        long maxArchiveBytes = resourceLimits != null ? resourceLimits.getMaxArchiveSizeBytes() : 15_728_640L;
        long maxFileBytes = resourceLimits != null ? resourceLimits.getMaxFileSizeBytes() : 1_048_576L;
        long maxExtractedBytes = resourceLimits != null ? resourceLimits.getMaxExtractedSizeBytes() : 10_485_760L;
        int maxFiles = resourceLimits != null ? resourceLimits.getMaxSourceFiles() : 150;

        // 1. Content-Length check if available
        long contentLength = response.headers().firstValueAsLong("Content-Length").orElse(-1L);
        if (contentLength > maxArchiveBytes) {
            throw new RepositoryResourceLimitExceededException(
                    "MAX_ARCHIVE_SIZE", contentLength, maxArchiveBytes, "bytes",
                    String.format("Repository archive size (%.1f MB) exceeds free-tier limit of %.1f MB",
                            contentLength / (1024.0 * 1024.0), maxArchiveBytes / (1024.0 * 1024.0)));
        }

        // 2. Count compressed stream bytes
        java.util.concurrent.atomic.AtomicLong totalCompressedRead = new java.util.concurrent.atomic.AtomicLong(0);
        InputStream countingStream = new java.io.FilterInputStream(response.body()) {
            @Override
            public int read() throws java.io.IOException {
                int b = super.read();
                if (b != -1) {
                    if (totalCompressedRead.incrementAndGet() > maxArchiveBytes) {
                        throw new RepositoryResourceLimitExceededException(
                                "MAX_ARCHIVE_SIZE", totalCompressedRead.get(), maxArchiveBytes, "bytes",
                                String.format("Repository archive stream exceeded free-tier limit of %.1f MB",
                                        maxArchiveBytes / (1024.0 * 1024.0)));
                    }
                }
                return b;
            }

            @Override
            public int read(byte[] b, int off, int len) throws java.io.IOException {
                int n = super.read(b, off, len);
                if (n > 0) {
                    if (totalCompressedRead.addAndGet(n) > maxArchiveBytes) {
                        throw new RepositoryResourceLimitExceededException(
                                "MAX_ARCHIVE_SIZE", totalCompressedRead.get(), maxArchiveBytes, "bytes",
                                String.format("Repository archive stream exceeded free-tier limit of %.1f MB",
                                        maxArchiveBytes / (1024.0 * 1024.0)));
                    }
                }
                return n;
            }
        };

        Map<String, String> files = new HashMap<>();
        long totalExtractedBytes = 0;
        try (ZipInputStream zis = new ZipInputStream(countingStream)) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    zis.closeEntry();
                    continue;
                }
                String name = entry.getName();
                int slashIdx = name.indexOf('/');
                if (slashIdx != -1) {
                    String relativePath = name.substring(slashIdx + 1);
                    if (isAnalyzableSourceFile(relativePath)) {
                        if (files.size() >= maxFiles) {
                            throw new RepositoryResourceLimitExceededException(
                                    "MAX_SOURCE_FILES", files.size() + 1, maxFiles, "files",
                                    String.format("Repository contains more than %d analyzable source files (free-tier limit: %d files).",
                                            maxFiles, maxFiles));
                        }

                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        int read;
                        long fileBytes = 0;
                        while ((read = zis.read(buffer)) != -1) {
                            fileBytes += read;
                            if (fileBytes > maxFileBytes) {
                                throw new RepositoryResourceLimitExceededException(
                                        "MAX_FILE_SIZE", fileBytes, maxFileBytes, "bytes",
                                        String.format("File '%s' size (%.1f KB) exceeds single-file free-tier limit of %.1f KB.",
                                                relativePath, fileBytes / 1024.0, maxFileBytes / 1024.0));
                            }
                            totalExtractedBytes += read;
                            if (totalExtractedBytes > maxExtractedBytes) {
                                throw new RepositoryResourceLimitExceededException(
                                        "MAX_EXTRACTED_SIZE", totalExtractedBytes, maxExtractedBytes, "bytes",
                                        String.format("Total extracted source size (%.1f MB) exceeds free-tier limit of %.1f MB.",
                                                totalExtractedBytes / (1024.0 * 1024.0), maxExtractedBytes / (1024.0 * 1024.0)));
                            }
                            baos.write(buffer, 0, read);
                        }
                        files.put(relativePath, baos.toString(StandardCharsets.UTF_8));
                    }
                }
                zis.closeEntry();
            }
        }
        log.info("Successfully downloaded and extracted {} files from archive for {}", files.size(), url);
        return files;
    }

    public boolean isAnalyzableSourceFile(String path) {
        if (path == null) return false;
        String lower = path.toLowerCase();
        if (lower.contains("node_modules/") || lower.contains(".git/") || lower.contains("target/")
                || lower.contains("build/") || lower.contains("dist/") || lower.contains(".idea/")
                || lower.contains(".vscode/")) {
            return false;
        }
        return lower.endsWith(".java") || lower.endsWith(".js") || lower.endsWith(".jsx")
                || lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".json")
                || lower.endsWith(".xml") || lower.endsWith(".gradle") || lower.endsWith(".properties")
                || lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".sql")
                || lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith("dockerfile");
    }
}
