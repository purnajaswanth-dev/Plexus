package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "code_endpoints", indexes = {
        @Index(name = "idx_endpoint_repo", columnList = "repository_id"),
        @Index(name = "idx_endpoint_snapshot", columnList = "snapshot_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodeEndpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "repository_id", nullable = false)
    private Repository repository;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id", nullable = false)
    private ArchitectureSnapshot snapshot;

    @Column(nullable = false, length = 16)
    private String httpMethod; // GET, POST, PUT, DELETE, PATCH, etc.

    @Column(nullable = false, length = 512)
    private String routePath; // /api/orders, /users/{id}

    @Column(nullable = false)
    private String controllerClass; // OrderController

    @Column(nullable = false)
    private String handlerMethod; // createOrder

    @Column(columnDefinition = "TEXT")
    private String parametersJson; // [{"name":"id","type":"Long","in":"path"}]

    private String requestBodyType; // CreateOrderDTO

    private String responseType; // ResponseEntity<OrderResponse>

    private String sourceFile; // src/main/java/...

    private Integer startLine;

    private Integer endLine;

    private String nodeKey; // endpoint:POST:/api/orders

    @Column(length = 32)
    @Builder.Default
    private String apiCategory = "REST";

    @Column(length = 32)
    @Builder.Default
    private String authClassification = "AUTHENTICATED";

    @Column(length = 32)
    @Builder.Default
    private String analysisStatus = "COMPLETE";

    @Builder.Default
    private LocalDateTime discoveredAt = LocalDateTime.now();
}

