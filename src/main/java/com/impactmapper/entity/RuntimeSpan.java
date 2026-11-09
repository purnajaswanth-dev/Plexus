package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "runtime_spans", indexes = {
        @Index(name = "idx_span_trace", columnList = "trace_id"),
        @Index(name = "idx_span_spanid", columnList = "spanId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RuntimeSpan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trace_id", nullable = false)
    private RuntimeTrace trace;

    @Column(nullable = false, length = 64)
    private String spanId;

    private String parentSpanId;

    private String componentKey; // maps to ArchitectureNode nodeKey if matched

    @Column(nullable = false)
    private String componentName;

    @Column(nullable = false)
    private String operationName; // methodName or HTTP path

    private Long durationMs;

    private Long startOffsetMs;

    @Builder.Default
    private Boolean hasError = false;

    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String attributesJson;
}

