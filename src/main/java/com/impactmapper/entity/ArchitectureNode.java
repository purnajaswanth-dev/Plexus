package com.impactmapper.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "architecture_nodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArchitectureNode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id", nullable = false)
    private ArchitectureSnapshot snapshot;

    @Column(nullable = false)
    private String nodeKey;

    @Column(nullable = false)
    private String name;

    // REPOSITORY, MODULE, DIRECTORY, PACKAGE, FILE, CLASS, INTERFACE, METHOD, API_ENDPOINT, ENTITY, EXTERNAL_DEPENDENCY
    @Column(nullable = false)
    private String nodeType;

    private String filePath;
    private String packageOrModule;

    @Column(columnDefinition = "TEXT")
    private String annotationsJson;

    private Integer startLine;
    private Integer endLine;

    // DIRECTLY_DETECTED, STATIC_INFERENCE
    private String evidenceConfidence;

    // 1 = High-level (Package/Module), 2 = Component (Class/Service/Entity), 3 = Detailed (Method/Endpoint)
    private Integer level;
}

