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
public class CityBlockDTO {
    private String id;
    private String districtId;
    private String name;
    private String folderPath;
    private String packageName;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private String surfaceColor;
    private String curbColor;
    @Builder.Default
    private List<String> buildingIds = new ArrayList<>();
    private Integer plotCount;
}

