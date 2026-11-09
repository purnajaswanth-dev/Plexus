package com.impactmapper.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GitHubRepoInfo {
    private String name;
    private String fullName;
    private String description;
    private String defaultBranch;
    private String language;
    private String htmlUrl;
}
