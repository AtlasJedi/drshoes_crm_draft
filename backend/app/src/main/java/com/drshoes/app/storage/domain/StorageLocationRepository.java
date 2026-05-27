package com.drshoes.app.storage.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import lombok.Getter;
import lombok.Setter;

public interface StorageLocationRepository extends JpaRepository<StorageLocation, Long> {
    @Query("SELECT l FROM StorageLocation l WHERE l.active = true ORDER BY l.position ASC, l.name ASC")
    List<StorageLocation> findAllActive();
    @Query("SELECT l FROM StorageLocation l ORDER BY l.active DESC, l.position ASC, l.name ASC")
    List<StorageLocation> findAllIncludingInactive();

    Optional<StorageLocation> findByName(String name);

    boolean existsByNameAndActiveTrue(String name);
}
