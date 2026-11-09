package com.impactmapper.parser;

import com.impactmapper.dto.ParsedDep;
import lombok.Builder;
import lombok.Data;

import java.util.*;

@Data
@Builder
public class ManifestDiscoveryResult {
    @Builder.Default
    private List<ParsedDep> allDependencies = new ArrayList<>();
    @Builder.Default
    private List<ManifestParseResult> manifestResults = new ArrayList<>();
    @Builder.Default
    private Set<String> ecosystems = new LinkedHashSet<>();
    @Builder.Default
    private List<String> manifestPaths = new ArrayList<>();
    private String primaryEcosystem;
    private boolean isMonorepo;
    private boolean hasManifests;
}

