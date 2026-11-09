package com.impactmapper.dto;

import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitTreeResult {
    private String commitSha;
    private List<String> filePaths;
    @Builder.Default
    private boolean truncated = false;

    public GitTreeResult(String commitSha, List<String> filePaths) {
        this.commitSha = commitSha;
        this.filePaths = filePaths;
        this.truncated = false;
    }
}
