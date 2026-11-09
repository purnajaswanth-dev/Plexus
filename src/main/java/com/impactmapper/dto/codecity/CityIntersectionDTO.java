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
public class CityIntersectionDTO {
    private String id;
    private String name;
    private Double x;
    private Double y;
    private Double radius;
    private Boolean hasTrafficSignal;
    private Boolean hasCrosswalk;
    @Builder.Default
    private List<String> streetIds = new ArrayList<>();
}

