package com.drshoes.app.photo.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
public interface PhotoRepository extends JpaRepository<Photo, UUID> {

    List<Photo> findByOrderIdOrderByUploadedAtDesc(UUID orderId);
}
