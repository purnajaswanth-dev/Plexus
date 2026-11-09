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
public class CityModelDTO {
    private Long repositoryId;
    private String repositoryName;
    private String commitSha;
    private String primaryLanguage;
    private Long snapshotId;
    private Double cityWidth;
    private Double cityHeight;
    @Builder.Default
    private List<CityDistrictDTO> districts = new ArrayList<>();
    @Builder.Default
    private List<CityBlockDTO> blocks = new ArrayList<>();
    @Builder.Default
    private List<CityStreetDTO> streets = new ArrayList<>();
    @Builder.Default
    private List<CityIntersectionDTO> intersections = new ArrayList<>();
    @Builder.Default
    private List<CityBuildingDTO> buildings = new ArrayList<>();
    @Builder.Default
    private List<CityLandmarkDTO> landmarks = new ArrayList<>();
    @Builder.Default
    private List<CityRoadDTO> roads = new ArrayList<>();
    private CityStatsDTO stats;
}

