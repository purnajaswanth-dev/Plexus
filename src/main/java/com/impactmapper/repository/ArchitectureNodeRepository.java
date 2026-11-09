package com.impactmapper.repository;

import com.impactmapper.entity.ArchitectureNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface ArchitectureNodeRepository extends JpaRepository<ArchitectureNode, Long> {
    List<ArchitectureNode> findBySnapshotId(Long snapshotId);
    List<ArchitectureNode> findBySnapshotIdAndLevelLessThanEqual(Long snapshotId, Integer maxLevel);
    java.util.Optional<ArchitectureNode> findBySnapshotIdAndNodeKey(Long snapshotId, String nodeKey);

    @Transactional
    void deleteBySnapshotId(Long snapshotId);
}

