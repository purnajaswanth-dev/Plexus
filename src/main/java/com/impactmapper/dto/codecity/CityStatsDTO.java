package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityStatsDTO {
    private Integer totalDistricts;
    private Integer totalBuildings;
    private Integer totalRoads;
    private Integer totalEndpoints;
    private Integer totalControllers;
    private Integer totalServices;
    private Integer totalRepositories;
    private Integer totalEntities;
    private Integer totalTraces;
}

