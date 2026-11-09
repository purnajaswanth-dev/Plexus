package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "architecture_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArchitectureSnapshot {
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

    private String commitSha;
    private LocalDateTime analyzedAt;
    private String status; // ANALYZED, PARTIAL, FAILED
    private String primaryLanguage;
    private Integer totalFilesAnalyzed;
    private Integer totalComponents;
    private Integer totalRelationships;

    @Column(columnDefinition = "TEXT")
    private String analysisSummary;

    @PrePersist
    protected void onCreate() {
        if (analyzedAt == null) {
            analyzedAt = LocalDateTime.now();
        }
    }
}

