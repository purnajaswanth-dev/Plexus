package com.impactmapper.parser;

import com.impactmapper.dto.ParsedDep;
import lombok.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManifestParseResult {
    private String manifestPath;
    private String ecosystem;
    @Builder.Default
    private List<ParsedDep> dependencies = new ArrayList<>();
    @Builder.Default
    private boolean success = true;
    @Builder.Default
    private List<String> diagnostics = new ArrayList<>();
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();

    public static ManifestParseResult failure(String manifestPath, String ecosystem, String error) {
        List<String> diags = new ArrayList<>();
        diags.add(error);
        return ManifestParseResult.builder()
                .manifestPath(manifestPath)
                .ecosystem(ecosystem)
                .dependencies(new ArrayList<>())
                .success(false)
                .diagnostics(diags)
                .build();
    }
}

