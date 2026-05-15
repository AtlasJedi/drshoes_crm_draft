package com.drshoes.app.sklep;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link ProductReservation}.
 * active = status not 'CANCELLED'.
 */
public interface ProductReservationRepository extends JpaRepository<ProductReservation, UUID> {

    /** Active reservations for a given product, ordered oldest-first. */
    List<ProductReservation> findByProductIdAndStatusNotOrderByReservedAtAsc(UUID productId, String status);

    /**
     * Latest N reservations across all products, newest-first.
     * Used by FreshReservationsPanel on the dashboard.
     */
    @Query("SELECT r FROM ProductReservation r WHERE r.status <> 'CANCELLED' ORDER BY r.createdAt DESC")
    List<ProductReservation> findLatestActive(Pageable pageable);
}
