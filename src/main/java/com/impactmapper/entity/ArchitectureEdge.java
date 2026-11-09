package com.impactmapper.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "architecture_edges")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArchitectureEdge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id", nullable = false)
    private ArchitectureSnapshot snapshot;

    @Column(nullable = false)
    private String sourceNodeKey;

    @Column(nullable = false)
    private String targetNodeKey;

    // CONTAINS, IMPORTS, CALLS, IMPLEMENTS, EXTENDS, EXPOSES, DECLARES, PERSISTS_TO, DEPENDS_ON
    @Column(nullable = false)
    private String relationshipType;

    @Column(columnDefinition = "TEXT")
    private String evidence;

    // DIRECTLY_DETECTED, STATIC_INFERENCE
    private String evidenceLevel;
}

