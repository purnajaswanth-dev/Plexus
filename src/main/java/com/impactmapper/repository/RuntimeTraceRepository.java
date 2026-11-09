package com.impactmapper.repository;

import com.impactmapper.entity.RuntimeTrace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RuntimeTraceRepository extends JpaRepository<RuntimeTrace, Long> {
    Optional<RuntimeTrace> findByTraceId(String traceId);
    List<RuntimeTrace> findByRepositoryIdOrderByRecordedAtDesc(Long repositoryId);
}

