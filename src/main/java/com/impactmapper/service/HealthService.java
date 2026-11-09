package com.impactmapper.service;

import com.impactmapper.entity.RepoDependency;
import com.impactmapper.entity.Repository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class HealthService {

    public static class HealthReport {
        private final int score;
        private final String rating; // Healthy, Moderate, Critical, Provisional
        private final List<String> issues;

        public HealthReport(int score, String rating, List<String> issues) {
            this.score = score;
            this.rating = rating;
            this.issues = issues;
        }

        public int getScore() {
            return score;
        }

        public String getRating() {
            return rating;
        }

        public List<String> getIssues() {
            return issues;
        }
    }

    public HealthReport evaluateHealth(Repository repository, List<RepoDependency> dependencies) {
        List<String> issues = new ArrayList<>();

        if ("FAILED".equalsIgnoreCase(repository.getIndexStatus())) {
            String detail = repository.getStatusDetail() != null && !repository.getStatusDetail().isBlank()
                    ? repository.getStatusDetail()
                    : "Repository indexing failed";
            issues.add(detail);
            return new HealthReport(25, "Critical", issues);
        }

        // Repositories with no manifest
        if ("INDEXED_NO_MANIFEST".equalsIgnoreCase(repository.getIndexStatus())
                || "NONE".equalsIgnoreCase(repository.getDependencyFileType())
                || dependencies == null || dependencies.isEmpty()) {

            int score = 80;
            String rating = "Healthy";
            issues.add("No external dependency manifests declared; health evaluated based on source repository presence.");
            if (repository.getLanguage() != null && !repository.getLanguage().isBlank()) {
                issues.add("Primary language: " + repository.getLanguage());
            }
            if (repository.getTotalFilesDiscovered() != null && repository.getTotalFilesDiscovered() > 0) {
                issues.add(repository.getTotalFilesDiscovered() + " repository files indexed");
            }
            return new HealthReport(score, rating, issues);
        }

        int score = 100;

        // Check for unresolved or unknown versions
        long unresolvedCount = dependencies.stream()
                .filter(d -> d.getVersion() == null
                        || d.getVersion().isBlank()
                        || "RESOLVED_AT_BUILD_TIME".equalsIgnoreCase(d.getVersion())
                        || "unknown".equalsIgnoreCase(d.getVersion()))
                .count();

        if (unresolvedCount > 0) {
            int deduction = (int) Math.min(25, unresolvedCount * 5);
            score -= deduction;
            issues.add(unresolvedCount + " dependenc" + (unresolvedCount == 1 ? "y has" : "ies have")
                    + " build-time or unresolved versions");
        }

        // Check for snapshot versions in Maven
        long snapshotCount = dependencies.stream()
                .filter(d -> d.getVersion() != null && d.getVersion().toUpperCase().contains("SNAPSHOT"))
                .count();

        if (snapshotCount > 0) {
            score -= 10;
            issues.add(snapshotCount + " snapshot dependenc" + (snapshotCount == 1 ? "y" : "ies") + " detected");
        }

        score = Math.max(10, Math.min(100, score));

        String rating;
        if (score >= 80) {
            rating = "Healthy";
        } else if (score >= 50) {
            rating = "Moderate";
        } else {
            rating = "Critical";
        }

        if (issues.isEmpty()) {
            issues.add("All dependencies resolved with clean version specifications");
        }

        return new HealthReport(score, rating, issues);
    }
}
