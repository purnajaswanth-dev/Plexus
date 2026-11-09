package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "static_execution_paths", indexes = {
        @Index(name = "idx_execpath_endpoint", columnList = "endpoint_id"),
        @Index(name = "idx_execpath_snapshot", columnList = "snapshot_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaticExecutionPath {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "endpoint_id", nullable = false)
    private CodeEndpoint endpoint;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id", nullable = false)
    private ArchitectureSnapshot snapshot;

    private Integer totalSteps;

    @Column(columnDefinition = "TEXT")
    private String inferredSummary;

    @Builder.Default
    private Boolean hasAlternativeBranches = false;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "path", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("stepIndex ASC")
    @Builder.Default
    private List<StaticExecutionStep> steps = new ArrayList<>();
}

