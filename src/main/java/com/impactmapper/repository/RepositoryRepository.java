package com.impactmapper.repository;

import com.impactmapper.entity.Repository;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RepositoryRepository extends JpaRepository<Repository, Long> {
    Optional<Repository> findByRepoName(String repoName);
    List<Repository> findByIndexStatus(String status);
    List<Repository> findAllByOrderByAddedAtDesc();

    // Multi-User Owner-Scoped Queries
    List<Repository> findByOwnerIdOrderByAddedAtDesc(java.util.UUID ownerId);
    Optional<Repository> findByIdAndOwnerId(Long id, java.util.UUID ownerId);
    Optional<Repository> findByOwnerIdAndRepoName(java.util.UUID ownerId, String repoName);
    List<Repository> findByOwnerIdAndIndexStatus(java.util.UUID ownerId, String status);
    boolean existsByIdAndOwnerId(Long id, java.util.UUID ownerId);
}
