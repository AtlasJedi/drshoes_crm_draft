package com.drshoes.app.order.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {
    Optional<Order> findByCode(String code);
    Page<Order> findAllByDeletedAtIsNull(Pageable pageable);

    /**
     * Finds non-deleted orders whose planned pickup falls on the given Warsaw-local date.
     * Native query used because HQL CAST(Instant AS LocalDate) is unreliable across Hibernate versions.
     */
    @Query(value = """
            SELECT * FROM order_
            WHERE deleted_at IS NULL
              AND planned_pickup_at IS NOT NULL
              AND (planned_pickup_at AT TIME ZONE 'Europe/Warsaw')::date = :targetDate
            """, nativeQuery = true)
    List<Order> findAllByPlannedPickupDate(@Param("targetDate") LocalDate targetDate);

    /**
     * Finds non-deleted orders whose delivered_at falls on the given Warsaw-local date.
     * Native query for the same Instant-cast reason as findAllByPlannedPickupDate.
     */
    @Query(value = """
            SELECT * FROM order_
            WHERE deleted_at IS NULL
              AND delivered_at IS NOT NULL
              AND (delivered_at AT TIME ZONE 'Europe/Warsaw')::date = :targetDate
            """, nativeQuery = true)
    List<Order> findAllByDeliveredDate(@Param("targetDate") LocalDate targetDate);
}
