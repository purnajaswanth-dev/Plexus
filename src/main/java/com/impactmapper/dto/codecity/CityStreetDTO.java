package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityStreetDTO {
    private String id;
    private String name;
    private String streetType; // AVENUE, SECONDARY_STREET, LOCAL_STREET, ALLEY
    private String districtId;
    private Double x1;
    private Double y1;
    private Double x2;
    private Double y2;
    private Double width; // 32 for avenue, 20 for secondary, 12 for local
    private Integer laneCount; // 4 for avenue, 2 for secondary, 1 for local
    private Boolean hasCenterline;
    private Boolean isAvenue;
    private String surfaceColor;
    private String markingColor;
    @Builder.Default
    private List<String> connectedIntersectionIds = new ArrayList<>();
}

