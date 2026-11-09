package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "repo_dependencies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RepoDependency {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "repo_id", nullable = false)
    private Repository repository;

    @JsonProperty("repoId")
    public Long getRepoId() {
        return repository != null ? repository.getId() : null;
    }

    private String groupId;
    private String artifactId;
    private String version;
    private String scope;
    private Boolean isDev;
    private String packageType; // MAVEN, NPM, GRADLE, PYTHON, GO, etc.
    private String manifestPath; // e.g. "backend/pom.xml", "frontend/package.json"
}
