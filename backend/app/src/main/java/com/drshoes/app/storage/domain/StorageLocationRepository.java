package com.drshoes.app.storage.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StorageLocationRepository extends JpaRepository<StorageLocation, Long> {

    /** Active locations ordered by position then name (UI picker default). */
    @Query("SELECT l FROM StorageLocation l WHERE l.active = true ORDER BY l.position ASC, l.name ASC")
    List<StorageLocation> findAllActive();

    /** All locations including inactive — admin panel view. */
    @Query("SELECT l FROM StorageLocation l ORDER BY l.active DESC, l.position ASC, l.name ASC")
    List<StorageLocation> findAllIncludingInactive();

    Optional<StorageLocation> findByName(String name);

    boolean existsByNameAndActiveTrue(String name);
}
