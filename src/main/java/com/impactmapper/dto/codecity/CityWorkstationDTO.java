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
public class CityWorkstationDTO {
    private String id; // method key or synthetic ID
    private String name; // methodName
    private String signature; // methodName(paramTypes): returnType
    private String returnType;
    @Builder.Default
    private List<String> parameterTypes = new ArrayList<>();
    private Integer startLine;
    private Integer endLine;
    private String visibility; // public, protected, private
    private boolean isConstructor;
    private boolean isStatic;
    private boolean isAbstract;
    private boolean isFrameworkOperation;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
}

