package com.impactmapper.repository;

import com.impactmapper.entity.ArchitectureEdge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface ArchitectureEdgeRepository extends JpaRepository<ArchitectureEdge, Long> {
    List<ArchitectureEdge> findBySnapshotId(Long snapshotId);
    List<ArchitectureEdge> findBySnapshotIdAndTargetNodeKey(Long snapshotId, String targetNodeKey);
    List<ArchitectureEdge> findBySnapshotIdAndSourceNodeKey(Long snapshotId, String sourceNodeKey);

    @Transactional
    void deleteBySnapshotId(Long snapshotId);
}

