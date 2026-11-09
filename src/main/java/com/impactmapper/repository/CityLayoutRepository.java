package com.impactmapper.repository;

import com.impactmapper.entity.CityLayout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface CityLayoutRepository extends JpaRepository<CityLayout, Long> {
    Optional<CityLayout> findBySnapshotId(Long snapshotId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("DELETE FROM CityLayout l WHERE l.snapshot.id = :snapshotId")
    void deleteBySnapshotId(@Param("snapshotId") Long snapshotId);
}

