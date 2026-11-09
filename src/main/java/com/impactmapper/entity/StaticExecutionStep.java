package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "static_execution_steps", indexes = {
        @Index(name = "idx_step_path", columnList = "path_id"),
        @Index(name = "idx_step_order", columnList = "path_id, stepIndex")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaticExecutionStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "path_id", nullable = false)
    private StaticExecutionPath path;

    @Column(nullable = false)
    private Integer stepIndex;

    @Column(nullable = false)
    private String sourceComponentKey; // class:com.example.OrderController

    @Column(nullable = false)
    private String sourceComponentName; // OrderController

    private String targetComponentKey; // class:com.example.OrderService

    private String targetComponentName; // OrderService

    private String sourceMethod; // createOrder

    private String targetMethod; // processOrder

    @Column(columnDefinition = "TEXT")
    private String callExpression; // orderService.processOrder(dto)

    private Integer sourceLineNumber;

    @Column(nullable = false)
    private String relationshipType; // ENTRY_POINT, CALLS, PERSISTS_TO, RETURNS

    private String branchCondition; // if (stockAvailable)

    @Column(columnDefinition = "TEXT")
    private String evidence;

    @Builder.Default
    private Boolean isResolved = true;
}

