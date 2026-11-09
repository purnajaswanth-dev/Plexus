package com.impactmapper.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "city_layouts", indexes = {
        @Index(name = "idx_layout_snapshot", columnList = "snapshot_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CityLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snapshot_id", nullable = false)
    private ArchitectureSnapshot snapshot;

    @Column(nullable = false)
    private String layoutAlgorithm; // e.g. "DISTRICT_PACKING_2D_V1"

    private Double cityWidth;

    private Double cityHeight;

    @Column(columnDefinition = "TEXT")
    private String districtsJson;

    @Column(columnDefinition = "TEXT")
    private String buildingsJson;

    @Column(columnDefinition = "TEXT")
    private String roadsJson;

    @Builder.Default
    private LocalDateTime calculatedAt = LocalDateTime.now();
}

