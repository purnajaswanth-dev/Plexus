package com.impactmapper.service;

import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import jakarta.persistence.JoinColumn;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

public class RepoDependencySchemaTest {

    @Test
    @DisplayName("Verify RepoDependency entity uses canonical snake_case 'repo_id' for @JoinColumn")
    void testRepoDependencyJoinColumnIsSnakeCase() throws NoSuchFieldException {
        Field repoField = RepoDependency.class.getDeclaredField("repository");
        JoinColumn joinColumn = repoField.getAnnotation(JoinColumn.class);

        assertNotNull(joinColumn, "repository field must have @JoinColumn annotation");
        assertEquals("repo_id", joinColumn.name(), "JoinColumn name must be canonical snake_case 'repo_id'");
        assertFalse(joinColumn.nullable(), "repo_id must be non-nullable");
    }

    @Test
    @DisplayName("Verify Flyway migration V3 exists and safely renames 'repoId' to 'repo_id'")
    void testFlywayV3MigrationScript() throws Exception {
        Path v3Path = Path.of("src/main/resources/db/migration/V3__align_repo_dependencies_column_naming.sql");
        assertTrue(Files.exists(v3Path), "Flyway V3 migration script must exist");

        String content = Files.readString(v3Path);
        assertTrue(content.contains("RENAME COLUMN \"repoId\" TO repo_id"),
                "V3 must rename mixed-case \"repoId\" to canonical snake_case repo_id");
        assertTrue(content.contains("idx_repo_dep_repo_id"),
                "V3 must update the index to idx_repo_dep_repo_id");
    }

    @Test
    @DisplayName("Verify RepoDependency instantiation and relationship integrity")
    void testRepoDependencyBuilder() {
        Repository repo = Repository.builder().id(42L).repoName("test/repo").build();
        RepoDependency dep = RepoDependency.builder()
                .id(1L)
                .repository(repo)
                .groupId("org.springframework.boot")
                .artifactId("spring-boot-starter-web")
                .version("3.2.5")
                .scope("compile")
                .packageType("MAVEN")
                .manifestPath("pom.xml")
                .build();

        assertNotNull(dep);
        assertEquals(42L, dep.getRepository().getId());
        assertEquals("spring-boot-starter-web", dep.getArtifactId());
    }

    @Test
    @DisplayName("Verify RepoDependency and Repository have @JsonIgnore on lazy relations to prevent serialization failure")
    void testJsonIgnoreOnLazyRelations() throws Exception {
        Field depRepoField = RepoDependency.class.getDeclaredField("repository");
        assertNotNull(depRepoField.getAnnotation(com.fasterxml.jackson.annotation.JsonIgnore.class),
                "RepoDependency.repository must be annotated with @JsonIgnore to prevent Jackson lazy initialization failure");

        Field repoOwnerField = Repository.class.getDeclaredField("owner");
        assertNotNull(repoOwnerField.getAnnotation(com.fasterxml.jackson.annotation.JsonIgnore.class),
                "Repository.owner must be annotated with @JsonIgnore to prevent Jackson lazy initialization failure");

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.findAndRegisterModules();

        Repository repo = Repository.builder()
                .id(100L)
                .repoName("test/sample-repo")
                .owner(com.impactmapper.entity.AppUser.builder().id(java.util.UUID.randomUUID()).email("user@example.com").build())
                .build();

        RepoDependency dep = RepoDependency.builder()
                .id(1L)
                .repository(repo)
                .groupId("com.example")
                .artifactId("core")
                .version("1.0.0")
                .build();

        String repoJson = mapper.writeValueAsString(repo);
        assertFalse(repoJson.contains("user@example.com"), "Repository JSON must not serialize lazy AppUser owner");

        String depJson = mapper.writeValueAsString(dep);
        assertFalse(depJson.contains("sample-repo"), "RepoDependency JSON must not serialize lazy Repository");
        assertTrue(depJson.contains("\"repoId\":100"), "RepoDependency JSON must expose repoId");
    }
}
