package com.drshoes.app.order.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
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
     * Finds non-deleted orders whose picked_up_at falls on the given Warsaw-local date.
     * Used by ScheduledTriggerJob.runAfterHandover for AFTER_HANDOVER_Y_DAYS triggers.
     * Native query for the same Instant-cast reason as findAllByPlannedPickupDate.
     */
    @Query(value = """
            SELECT * FROM order_
            WHERE deleted_at IS NULL
              AND picked_up_at IS NOT NULL
              AND (picked_up_at AT TIME ZONE 'Europe/Warsaw')::date = :targetDate
            """, nativeQuery = true)
    List<Order> findAllByPickedUpDate(@Param("targetDate") LocalDate targetDate);

    /** Count non-deleted orders in a given status. */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.status = :status AND o.deletedAt IS NULL")
    long countByStatusNotDeleted(@Param("status") OrderStatus status);

    /** Count non-deleted orders whose received_at falls within [from, to). */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.deletedAt IS NULL AND o.receivedAt >= :from AND o.receivedAt < :to")
    long countReceivedBetween(@Param("from") Instant from, @Param("to") Instant to);

    /** Sum total_price_cents for non-deleted orders whose received_at falls within [from, to). */
    @Query("SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.receivedAt >= :from AND o.receivedAt < :to")
    long sumRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);

    /**
     * Returns order counts per ISO week for the last N weeks ending with (and including) weekStart.
     * weekStart is the Monday of the most-recent week (UTC midnight).
     * Returns rows: [week_iso TEXT, repairs BIGINT, custom_ BIGINT].
     * An order is "repair" if ANY of its items has kind='NAPRAWA'; else "custom".
     * Weeks with no orders are NOT returned — caller must zero-fill the 8-slot window.
     */
    @Query(value = """
        SELECT
            TO_CHAR(DATE_TRUNC('week', o.received_at AT TIME ZONE 'Europe/Warsaw'), 'IYYY-"W"IW') AS week_iso,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'NAPRAWA'
            )) AS repairs,
            COUNT(*) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'NAPRAWA'
            )) AS custom_
        FROM order_ o
        WHERE o.deleted_at IS NULL
          AND o.received_at >= :windowStart
        GROUP BY week_iso
        ORDER BY week_iso
        """, nativeQuery = true)
    List<Object[]> countPerIsoWeek(@Param("windowStart") Instant windowStart);

    /**
     * Returns per-kind order counts for the mix donut.
     * An order's kind is determined by its first NAPRAWA item (→ NAPRAWA bucket),
     * else the kind of its first item overall; orders with no items go to a synthetic "NONE" bucket.
     * Simpler rule consistent with spec §6-6: NAPRAWA bucket = orders with ANY NAPRAWA item;
     * remaining orders are split by first non-NAPRAWA item kind (CUSTOM_BUTY, CUSTOM_KURTKA).
     * Returns rows: [kind TEXT, cnt BIGINT].
     */
    @Query(value = """
        SELECT
            CASE
                WHEN EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'NAPRAWA')
                     THEN 'NAPRAWA'
                WHEN EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'CUSTOM_BUTY')
                     THEN 'CUSTOM_BUTY'
                WHEN EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = o.id AND oi.kind = 'CUSTOM_KURTKA')
                     THEN 'CUSTOM_KURTKA'
                ELSE 'NONE'
            END AS kind,
            COUNT(*) AS cnt
        FROM order_ o
        WHERE o.deleted_at IS NULL
        GROUP BY kind
        """, nativeQuery = true)
    List<Object[]> countByItemKind();

    /**
     * Scheduled orders in the [fromInstant, toInstant) window — non-deleted, active statuses only.
     * Active = NOT IN (WYDANE, ANULOWANE). planned_pickup_at must be non-null.
     */
    @Query(value = """
        SELECT * FROM order_
        WHERE deleted_at IS NULL
          AND planned_pickup_at IS NOT NULL
          AND planned_pickup_at >= :fromInstant
          AND planned_pickup_at < :toInstant
          AND status NOT IN ('WYDANE', 'ANULOWANE')
        ORDER BY planned_pickup_at ASC
        """, nativeQuery = true)
    List<Order> findScheduledInWindow(@Param("fromInstant") Instant fromInstant,
                                      @Param("toInstant") Instant toInstant);

    /**
     * Unscheduled orders: no planned_pickup_at, non-deleted, active statuses.
     * Capped at 50 by received_at DESC.
     */
    @Query(value = """
        SELECT * FROM order_
        WHERE deleted_at IS NULL
          AND planned_pickup_at IS NULL
          AND status NOT IN ('WYDANE', 'ANULOWANE')
        ORDER BY received_at DESC
        LIMIT 50
        """, nativeQuery = true)
    List<Order> findUnscheduled();
}
