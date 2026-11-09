package com.impactmapper.repository;

import com.impactmapper.entity.ArchitectureSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface ArchitectureSnapshotRepository extends JpaRepository<ArchitectureSnapshot, Long> {
    Optional<ArchitectureSnapshot> findTopByRepositoryIdOrderByAnalyzedAtDesc(Long repoId);
    List<ArchitectureSnapshot> findByRepositoryIdOrderByAnalyzedAtDesc(Long repoId);

    @Transactional
    void deleteByRepositoryId(Long repoId);
}

