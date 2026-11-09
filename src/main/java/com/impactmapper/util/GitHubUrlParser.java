package com.impactmapper.util;

import lombok.Builder;
import lombok.Value;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class GitHubUrlParser {

    private static final Pattern OWNER_PATTERN = Pattern.compile("^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$");
    private static final Pattern REPO_PATTERN = Pattern.compile("^[a-zA-Z0-9_.-]+$");
    private static final Pattern SSH_PATTERN = Pattern.compile("^git@github\\.com:([^/]+)/([^/]+?)(?:\\.git)?$");

    @Value
    @Builder
    public static class ParsedRepo {
        String owner;
        String repo;
        String fullName;     // owner/repo
        String canonicalUrl; // https://github.com/owner/repo
    }

    /**
     * Parses and normalizes various forms of repository input:
     * - "owner/repo"
     * - "https://github.com/owner/repo"
     * - "https://github.com/owner/repo.git"
     * - "https://github.com/owner/repo/"
     * - "git@github.com:owner/repo.git"
     * - "https://github.com/owner/repo/tree/main"
     * - "https://github.com/owner/repo/blob/master/README.md"
     * - "https://github.com/owner/repo?tab=readme"
     */
    public static ParsedRepo parse(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("Repository URL or identifier cannot be empty.");
        }

        String raw = input.trim();

        // Check SSH format first: git@github.com:owner/repo.git
        Matcher sshMatcher = SSH_PATTERN.matcher(raw);
        if (sshMatcher.matches()) {
            return build(sshMatcher.group(1), sshMatcher.group(2));
        }

        // Clean query parameters and fragments
        int queryIdx = raw.indexOf('?');
        if (queryIdx != -1) {
            raw = raw.substring(0, queryIdx);
        }
        int hashIdx = raw.indexOf('#');
        if (hashIdx != -1) {
            raw = raw.substring(0, hashIdx);
        }

        // If it starts with protocol or github.com
        if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("github.com/")) {
            if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
                raw = "https://" + raw;
            }

            try {
                URI uri = URI.create(raw);
                String host = uri.getHost();
                if (host == null || (!host.equalsIgnoreCase("github.com") && !host.equalsIgnoreCase("www.github.com"))) {
                    throw new IllegalArgumentException("Only GitHub repositories are supported (hostname: " + host + ").");
                }

                String path = uri.getPath();
                if (path == null || path.isEmpty() || path.equals("/")) {
                    throw new IllegalArgumentException("GitHub URL missing repository path.");
                }

                // Strip leading /
                while (path.startsWith("/")) {
                    path = path.substring(1);
                }

                String[] segments = path.split("/");
                if (segments.length < 2) {
                    throw new IllegalArgumentException("GitHub URL must contain both owner and repository name: " + input);
                }

                String owner = segments[0];
                String repo = segments[1];

                return build(owner, repo);
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid repository URL format: " + input);
            }
        }

        // Otherwise assume owner/repo or owner/repo/tree/...
        String cleaned = raw.replaceAll("^/+", "");
        String[] parts = cleaned.split("/");
        if (parts.length >= 2) {
            return build(parts[0], parts[1]);
        }

        throw new IllegalArgumentException("Invalid repository format. Expected 'owner/repo' or 'https://github.com/owner/repo', got: " + input);
    }

    private static ParsedRepo build(String owner, String repo) {
        if (owner == null || owner.isBlank() || repo == null || repo.isBlank()) {
            throw new IllegalArgumentException("Owner and repository name must not be blank.");
        }

        String cleanedOwner = owner.trim();
        String cleanedRepo = repo.trim();

        // Strip .git suffix if present
        if (cleanedRepo.endsWith(".git")) {
            cleanedRepo = cleanedRepo.substring(0, cleanedRepo.length() - 4);
        }

        // Strip trailing slash
        if (cleanedRepo.endsWith("/")) {
            cleanedRepo = cleanedRepo.substring(0, cleanedRepo.length() - 1);
        }

        if (!OWNER_PATTERN.matcher(cleanedOwner).matches()) {
            throw new IllegalArgumentException("Invalid GitHub owner name: '" + cleanedOwner + "'. GitHub usernames must be alphanumeric and may contain hyphens.");
        }

        if (!REPO_PATTERN.matcher(cleanedRepo).matches()) {
            throw new IllegalArgumentException("Invalid GitHub repository name: '" + cleanedRepo + "'. Repository names may contain alphanumeric characters, hyphens, underscores, and periods.");
        }

        String fullName = cleanedOwner + "/" + cleanedRepo;
        String canonicalUrl = "https://github.com/" + fullName;

        return ParsedRepo.builder()
                .owner(cleanedOwner)
                .repo(cleanedRepo)
                .fullName(fullName)
                .canonicalUrl(canonicalUrl)
                .build();
    }
}

