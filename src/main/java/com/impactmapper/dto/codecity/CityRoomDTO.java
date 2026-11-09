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
public class CityRoomDTO {
    private String id; // type key e.g. class:com.example.OrderController
    private String name; // simpleName
    private String qualifiedName;
    private String kind; // CLASS, INTERFACE, ENUM, RECORD, INNER_CLASS
    private Integer startLine;
    private Integer endLine;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private boolean isAbstract;
    private boolean isInterface;
    private Integer cabinetCount;
    @Builder.Default
    private List<String> annotations = new ArrayList<>();
    @Builder.Default
    private List<CityWorkstationDTO> workstations = new ArrayList<>();
}

