package com.impactmapper.repository;

import com.impactmapper.entity.StaticExecutionPath;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface StaticExecutionPathRepository extends JpaRepository<StaticExecutionPath, Long> {
    Optional<StaticExecutionPath> findByEndpointId(Long endpointId);

    @Query("SELECT DISTINCT p FROM StaticExecutionPath p LEFT JOIN FETCH p.steps LEFT JOIN FETCH p.endpoint WHERE p.snapshot.id = :snapshotId")
    List<StaticExecutionPath> findBySnapshotId(@Param("snapshotId") Long snapshotId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("DELETE FROM StaticExecutionPath p WHERE p.snapshot.id = :snapshotId")
    void deleteBySnapshotId(@Param("snapshotId") Long snapshotId);
}

