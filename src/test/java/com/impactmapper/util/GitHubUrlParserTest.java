package com.impactmapper.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GitHubUrlParserTest {

    @Test
    void testNormalizeVariousGitHubUrls() {
        // Standard owner/repo
        GitHubUrlParser.ParsedRepo p1 = GitHubUrlParser.parse("purnajaswanth-dev/Aether");
        assertEquals("purnajaswanth-dev", p1.getOwner());
        assertEquals("Aether", p1.getRepo());
        assertEquals("purnajaswanth-dev/Aether", p1.getFullName());
        assertEquals("https://github.com/purnajaswanth-dev/Aether", p1.getCanonicalUrl());

        // HTTPS with trailing slash
        GitHubUrlParser.ParsedRepo p2 = GitHubUrlParser.parse("https://github.com/spring-projects/spring-petclinic/");
        assertEquals("spring-projects", p2.getOwner());
        assertEquals("spring-petclinic", p2.getRepo());
        assertEquals("spring-projects/spring-petclinic", p2.getFullName());

        // HTTPS with .git suffix
        GitHubUrlParser.ParsedRepo p3 = GitHubUrlParser.parse("https://github.com/torvalds/linux.git");
        assertEquals("torvalds", p3.getOwner());
        assertEquals("linux", p3.getRepo());

        // SSH format
        GitHubUrlParser.ParsedRepo p4 = GitHubUrlParser.parse("git@github.com:facebook/react.git");
        assertEquals("facebook", p4.getOwner());
        assertEquals("react", p4.getRepo());
        assertEquals("https://github.com/facebook/react", p4.getCanonicalUrl());

        // URL with branch reference
        GitHubUrlParser.ParsedRepo p5 = GitHubUrlParser.parse("https://github.com/apache/kafka/tree/trunk");
        assertEquals("apache", p5.getOwner());
        assertEquals("kafka", p5.getRepo());

        // URL with file blob and query params
        GitHubUrlParser.ParsedRepo p6 = GitHubUrlParser.parse("https://github.com/golang/go/blob/master/README.md?tab=readme");
        assertEquals("golang", p6.getOwner());
        assertEquals("go", p6.getRepo());
    }

    @Test
    void testInvalidInputs() {
        assertThrows(IllegalArgumentException.class, () -> GitHubUrlParser.parse(null));
        assertThrows(IllegalArgumentException.class, () -> GitHubUrlParser.parse(""));
        assertThrows(IllegalArgumentException.class, () -> GitHubUrlParser.parse("   "));
        assertThrows(IllegalArgumentException.class, () -> GitHubUrlParser.parse("justaname"));
        assertThrows(IllegalArgumentException.class, () -> GitHubUrlParser.parse("https://gitlab.com/owner/repo"));
        assertThrows(IllegalArgumentException.class, () -> GitHubUrlParser.parse("invalid owner/repo"));
    }
}

