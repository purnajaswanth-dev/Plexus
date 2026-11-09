package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityDistrictDTO {
    private String id;
    private String name;
    private String packageName;
    private String moduleName;
    private String description;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private String color; // primary theme color
    private String bgTint;
    private Integer buildingCount;
    private Integer neighbourhoodCount;
    private String districtType; // API_DISTRICT, SERVICE_DISTRICT, DATA_DISTRICT, DOMAIN_DISTRICT, GENERAL

    // Urban street grid
    private String folderPath;
    private String streetName;
    @Builder.Default
    private java.util.List<Double> avenueLines = new java.util.ArrayList<>();
    @Builder.Default
    private java.util.List<Double> crossStreetLines = new java.util.ArrayList<>();
}

