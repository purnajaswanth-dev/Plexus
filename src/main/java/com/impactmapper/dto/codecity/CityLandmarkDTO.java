package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityLandmarkDTO {
    private String id;
    private String name;
    private String landmarkType; // DATABASE_VAULT, MESSAGE_HUB, EXTERNAL_GATEWAY, API_ENTRANCE_PORTAL
    private String districtId;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private String silhouetteType;
    private String color;
    private String description;
    private String evidence;
}

