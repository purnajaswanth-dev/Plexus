package com.impactmapper.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Configurable resource limits for repository indexing and static analysis
 * to ensure stability within Render Free Tier (512 MB RAM container).
 */
@Component
@Getter
@Setter
public class IndexingResourceLimits {

    @Value("${plexus.indexing.max-source-files:150}")
    private int maxSourceFiles = 150;

    @Value("${plexus.indexing.max-archive-size-bytes:15728640}")
    private long maxArchiveSizeBytes = 15_728_640L; // 15 MB compressed ZIP

    @Value("${plexus.indexing.max-file-size-bytes:1048576}")
    private long maxFileSizeBytes = 1_048_576L; // 1 MB single source file

    @Value("${plexus.indexing.max-extracted-size-bytes:10485760}")
    private long maxExtractedSizeBytes = 10_485_760L; // 10 MB total extracted source strings

    @Value("${plexus.indexing.max-concurrent-analysis:1}")
    private int maxConcurrentAnalysis = 1;
}
