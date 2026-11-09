package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "repositories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Repository {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private AppUser owner;

    @Column(nullable = false)
    private String repoName;

    private String repoUrl;
    private String defaultBranch;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    private String language;
    private LocalDateTime lastIndexed;
    private String indexStatus; // INDEXED, INDEXED_NO_MANIFEST, FAILED, PENDING
    private String dependencyFileType; // MAVEN, NPM, GRADLE, PYTHON, MULTI_ECOSYSTEM, NONE
    private LocalDateTime addedAt;

    private String commitSha;

    @Column(columnDefinition = "TEXT")
    private String statusDetail;

    private Boolean isMonorepo;
    private Integer totalFilesDiscovered;

    @PrePersist
    protected void onCreate() {
        addedAt = LocalDateTime.now();
    }
}
