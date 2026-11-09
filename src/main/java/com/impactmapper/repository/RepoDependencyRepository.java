package com.impactmapper.repository;

import com.impactmapper.entity.RepoDependency;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;
import java.util.List;

public interface RepoDependencyRepository extends JpaRepository<RepoDependency, Long> {
    @EntityGraph(attributePaths = {"repository"})
    @Query("SELECT d FROM RepoDependency d")
    List<RepoDependency> findAllWithRepository();

    @EntityGraph(attributePaths = {"repository"})
    List<RepoDependency> findByRepositoryId(Long repoId);

    @EntityGraph(attributePaths = {"repository"})
    List<RepoDependency> findByRepositoryIdIn(Collection<Long> repoIds);

    @EntityGraph(attributePaths = {"repository"})
    List<RepoDependency> findByArtifactId(String artifactId);

    @EntityGraph(attributePaths = {"repository"})
    List<RepoDependency> findByArtifactIdAndGroupId(String artifactId, String groupId);

    @EntityGraph(attributePaths = {"repository"})
    List<RepoDependency> findByArtifactIdContainingIgnoreCase(String partialName);
    
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("DELETE FROM RepoDependency d WHERE d.repository.id = :repoId")
    void deleteByRepositoryId(@Param("repoId") Long repoId);
}
