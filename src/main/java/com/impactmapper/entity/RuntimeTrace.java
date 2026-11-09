package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "runtime_traces", indexes = {
        @Index(name = "idx_trace_traceid", columnList = "traceId", unique = true),
        @Index(name = "idx_trace_repo", columnList = "repository_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RuntimeTrace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String traceId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "repository_id", nullable = false)
    private Repository repository;

    private String commitSha;

    private String endpointRoute;

    private String httpMethod;

    private Integer statusCode;

    private Long durationMs;

    private String serviceName;

    @Builder.Default
    private LocalDateTime recordedAt = LocalDateTime.now();

    @Builder.Default
    private String environment = "local-agent";

    @OneToMany(mappedBy = "trace", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("startOffsetMs ASC")
    @Builder.Default
    private List<RuntimeSpan> spans = new ArrayList<>();
}

