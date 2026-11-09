package com.impactmapper.dto.codecity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CityRefDTO {
    private String districtId;
    private String buildingId; // full repo-relative filePath or canonical building ID
    private String roomId;     // declared type qualifiedName or key
    private String workstationId; // declared method name or key
    private String facilityId; // for external/db/broker e.g. "facility:db", "facility:external"
}

