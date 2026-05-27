package com.drshoes.app.sklep;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;
public interface ProductReservationRepository extends JpaRepository<ProductReservation, UUID> {
    List<ProductReservation> findByProductIdAndStatusNotOrderByReservedAtAsc(UUID productId, String status);
    @Query("SELECT r FROM ProductReservation r WHERE r.status <> 'CANCELLED' ORDER BY r.createdAt DESC")
    List<ProductReservation> findLatestActive(Pageable pageable);
}
