package com.impactmapper.repository;

import com.impactmapper.entity.CodeEndpoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CodeEndpointRepository extends JpaRepository<CodeEndpoint, Long> {
    List<CodeEndpoint> findByRepositoryIdOrderByRoutePathAsc(Long repositoryId);
    List<CodeEndpoint> findBySnapshotIdOrderByRoutePathAsc(Long snapshotId);
    long countBySnapshotId(Long snapshotId);
    Optional<CodeEndpoint> findBySnapshotIdAndHttpMethodAndRoutePath(Long snapshotId, String httpMethod, String routePath);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("DELETE FROM CodeEndpoint e WHERE e.snapshot.id = :snapshotId")
    void deleteBySnapshotId(@Param("snapshotId") Long snapshotId);
}

