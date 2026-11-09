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
public class CityBuildingDTO {
    private String id; // Canonical file-based ID or primary class key
    private String fileId; // Full repository-relative path e.g. "src/main/java/com/example/OrderService.java"
    private String name; // Simple file or primary class name
    private String districtId;
    private String districtName;
    private String componentType; // CONTROLLER, SERVICE, REPOSITORY, ENTITY, CLASS, INTERFACE, MODULE
    private String filePath;
    private String packageName;
    private Integer startLine;
    private Integer endLine;
    private Integer lineCount;
    private Integer methodCount;
    private Integer floorCount; // Calculated based on complexity / methods
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private String color;
    @Builder.Default
    private List<String> annotations = new ArrayList<>();
    @Builder.Default
    private List<String> entryPoints = new ArrayList<>(); // e.g. ["POST /api/orders"]
    @Builder.Default
    private List<String> methods = new ArrayList<>();
    @Builder.Default
    private List<CityRoomDTO> rooms = new ArrayList<>();
    private Integer inDegree;
    private Integer outDegree;

    // Architectural 2D visual language fields
    private String fileName;
    private String folderPath;
    private String silhouetteType; // TOWER_CONTROLLER, CAMPUS_SERVICE, BUNKER_REPOSITORY, VAULT_DATABASE, MODULAR_ENTITY, SUBSTATION_UTILITY
    private String streetAddress;
    private String roofColor;
    private String facadeColor;
    private String windowColor;
    private Double entranceX;
    private Double entranceY;
    private String sourceSnippet;

    // Honest gaps markers
    @Builder.Default
    private String gapStatus = "NONE"; // NONE, NO_RELATIONSHIP, ANALYSIS_UNSUPPORTED, ANALYSIS_INCOMPLETE, EXTERNAL_UNRESOLVED
    private String gapReason;

    // Advanced urban footprint & architecture
    private String footprintShape; // TOWER_SKYSCRAPER, CAMPUS_COMPLEX, COMMERCIAL_BLOCK, COMPACT_FACILITY, L_SHAPED_FACILITY, CIVIC_INFRASTRUCTURE
    private String footprintPolygon; // SVG polygon coordinate points or path d
    private String roofStyle; // HELIPAD, STEPPED_TOWER, SOLAR_ARRAY, CHILLER_PLANT, FLAT_PARAPET, ATRIUM_GLASS
    private String blockId; // Reference to CityBlockDTO
    private String orientation; // NORTH, SOUTH, EAST, WEST
    private String analysisStatus; // VERIFIED, SYNTAX_ONLY, UNSUPPORTED
    private String languageChip; // JV, TS, JS, PY, GO, CS, HTML, CSS, CFG, SQL
    private String roleChip; // SRC, TEST, CFG, DOC, BUILD, DATA, UI
    private Boolean isTestFile;
    private Integer cabinetCount;
}
