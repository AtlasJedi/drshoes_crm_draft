package com.drshoes.app.photo.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Placeholder compiled in task 3-1 so PhotoRepositoryTest compiles while @Disabled.
 * Full JPA repository (with @Query, etc.) ships in task 3-5.
 * Task 3-5 replaces this file with the real interface extending JpaRepository.
 */
public interface PhotoRepository extends JpaRepository<Photo, UUID> {

    List<Photo> findByOrderIdOrderByUploadedAtDesc(UUID orderId);
}
