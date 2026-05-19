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

    /** Sum total_price_cents for non-deleted orders whose status is in the given set. */
    @Query("SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.status IN :statuses")
    long sumTotalPriceByStatusIn(@Param("statuses") java.util.Set<OrderStatus> statuses);

    /** Sum total_price_cents for non-deleted WYDANE orders picked up in [from, to). */
    @Query("SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.status = com.drshoes.app.order.domain.OrderStatus.WYDANE AND o.pickedUpAt >= :from AND o.pickedUpAt < :to")
    long sumTotalPricePickedUpBetween(@Param("from") Instant from, @Param("to") Instant to);

    /**
     * Returns order counts per ISO week, classified by each order's PRIMARY item kind
     * (first item by position ASC, id ASC as tiebreak). Orders with no items are excluded.
     * Returns rows: [period_label TEXT "IYYY-\"W\"IW", primary_kind TEXT, order_count BIGINT].
     * Periods with no orders are NOT returned — caller zero-fills all 5 kind buckets per slot.
     */
    @Query(value = """
        WITH first_kind AS (
          SELECT DISTINCT ON (oi.order_id)
            oi.order_id,
            oi.kind
          FROM order_item oi
          ORDER BY oi.order_id, oi.position ASC, oi.id ASC
        )
        SELECT
          TO_CHAR(DATE_TRUNC('week', o.received_at AT TIME ZONE 'Europe/Warsaw'), 'IYYY-"W"IW') AS period_label,
          fk.kind AS primary_kind,
          COUNT(*) AS order_count
        FROM order_ o
        JOIN first_kind fk ON fk.order_id = o.id
        WHERE o.deleted_at IS NULL
          AND o.received_at >= :windowStart
        GROUP BY period_label, fk.kind
        ORDER BY period_label, fk.kind
        """, nativeQuery = true)
    List<Object[]> countPerIsoWeek(@Param("windowStart") Instant windowStart);

    /**
     * Groups orders by calendar month (Warsaw tz), classified by primary item kind.
     * Returns rows: [period_label TEXT "YYYY-MM", primary_kind TEXT, order_count BIGINT].
     */
    @Query(value = """
        WITH first_kind AS (
          SELECT DISTINCT ON (oi.order_id)
            oi.order_id,
            oi.kind
          FROM order_item oi
          ORDER BY oi.order_id, oi.position ASC, oi.id ASC
        )
        SELECT
          TO_CHAR(DATE_TRUNC('month', o.received_at AT TIME ZONE 'Europe/Warsaw'), 'YYYY-MM') AS period_label,
          fk.kind AS primary_kind,
          COUNT(*) AS order_count
        FROM order_ o
        JOIN first_kind fk ON fk.order_id = o.id
        WHERE o.deleted_at IS NULL
          AND o.received_at >= :windowStart
        GROUP BY period_label, fk.kind
        ORDER BY period_label, fk.kind
        """, nativeQuery = true)
    List<Object[]> countPerIsoMonth(@Param("windowStart") Instant windowStart);

    /**
     * Groups orders by calendar quarter (Warsaw tz), classified by primary item kind.
     * Returns rows: [period_label TEXT "YYYY-Q{1..4}", primary_kind TEXT, order_count BIGINT].
     */
    @Query(value = """
        WITH first_kind AS (
          SELECT DISTINCT ON (oi.order_id)
            oi.order_id,
            oi.kind
          FROM order_item oi
          ORDER BY oi.order_id, oi.position ASC, oi.id ASC
        )
        SELECT
          TO_CHAR(DATE_TRUNC('quarter', o.received_at AT TIME ZONE 'Europe/Warsaw'), 'YYYY')
            || '-Q' || EXTRACT(QUARTER FROM (o.received_at AT TIME ZONE 'Europe/Warsaw'))::int AS period_label,
          fk.kind AS primary_kind,
          COUNT(*) AS order_count
        FROM order_ o
        JOIN first_kind fk ON fk.order_id = o.id
        WHERE o.deleted_at IS NULL
          AND o.received_at >= :windowStart
        GROUP BY period_label, fk.kind
        ORDER BY period_label, fk.kind
        """, nativeQuery = true)
    List<Object[]> countPerIsoQuarter(@Param("windowStart") Instant windowStart);

    /**
     * Returns per-kind item counts for the Mix donut — "work still to do".
     * V033: 5 kinds — CZYSZCZENIE, RENOWACJA, NAPRAWA, SZEWC, CUSTOM.
     * Counts items (not orders) per kind from actively-in-progress orders only.
     * Orders in terminal/ready statuses (WYDANE, ANULOWANE, GOTOWE_DO_ODBIORU)
     * are excluded — those pieces of work are done or gone.
     * Returns rows: [kind TEXT, cnt BIGINT], one row per kind present in data.
     * Caller (DashboardChartsController) zero-fills missing kinds.
     */
    @Query(value = """
        SELECT oi.kind AS kind, COUNT(*) AS cnt
        FROM order_item oi
        JOIN order_ o ON o.id = oi.order_id
        WHERE o.deleted_at IS NULL
          AND o.status NOT IN ('WYDANE','ANULOWANE','GOTOWE_DO_ODBIORU')
        GROUP BY oi.kind
        """, nativeQuery = true)
    List<Object[]> countByItemKind();

    /**
     * Scheduled orders in the [fromInstant, toInstant) window — non-deleted, active statuses only.
     * Active = NOT IN (WYDANE, ANULOWANE). planned_pickup_at must be non-null.
     * Kept for backward compat; prefer findAllActiveInWindow for v2-B two-marker model.
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
     * Kept for backward compat; v2-B calendar no longer uses this.
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

    /**
     * v2-B: All active orders in the window, regardless of whether plannedPickupAt is set.
     * Window is based on received_at OR planned_pickup_at falling in [fromInstant, toInstant).
     * Active = NOT IN (WYDANE, ANULOWANE), non-deleted.
     * Orders outside the window but with effectivePickupAt in it are included via the +14d fallback.
     */
    @Query(value = """
        SELECT * FROM order_
        WHERE deleted_at IS NULL
          AND status NOT IN ('WYDANE', 'ANULOWANE')
          AND (
            (received_at >= :fromInstant AND received_at < :toInstant)
            OR (planned_pickup_at IS NOT NULL
                AND planned_pickup_at >= :fromInstant
                AND planned_pickup_at < :toInstant)
            OR (planned_pickup_at IS NULL
                AND received_at + INTERVAL '14 days' >= :fromInstant
                AND received_at + INTERVAL '14 days' < :toInstant)
          )
        ORDER BY received_at ASC
        """, nativeQuery = true)
    List<Order> findAllActiveInWindow(@Param("fromInstant") Instant fromInstant,
                                      @Param("toInstant") Instant toInstant);

    /**
     * Paged orders for a Kanban column ordered by received_at DESC.
     * Uses native LIMIT so the result is a plain List (not Page) to avoid count overhead.
     * status param is the enum name string (e.g. "PRZYJETE").
     */
    @Query(value = """
        SELECT * FROM order_
        WHERE status = :status AND deleted_at IS NULL
        ORDER BY received_at DESC
        LIMIT :lim
        """, nativeQuery = true)
    List<Order> findTopByStatusOrderByReceivedAtDesc(@Param("status") String status,
                                                     @Param("lim") int lim);

    /**
     * WYDANE column: paged by picked_up_at DESC NULLS LAST, capped at WYDANE_CAP (always 10 max).
     */
    @Query(value = """
        SELECT * FROM order_
        WHERE status = 'WYDANE' AND deleted_at IS NULL
        ORDER BY picked_up_at DESC NULLS LAST
        LIMIT :lim
        """, nativeQuery = true)
    List<Order> findTopWydaneOrderByPickedUpAtDesc(@Param("lim") int lim);

    /** Count non-deleted orders for a specific client (any status). */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL")
    long countByClientIdAndDeletedAtIsNull(@Param("clientId") UUID clientId);

    /**
     * Count non-deleted orders for a specific client whose status is in the given list.
     * Used by ClientSummaryService to count "closed" orders (WYDANE | ANULOWANE).
     */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL AND o.status IN :statuses")
    long countByClientIdAndStatusInAndDeletedAtIsNull(@Param("clientId") UUID clientId,
                                                      @Param("statuses") List<OrderStatus> statuses);

    /**
     * Returns the received_at of the most recent non-deleted order for a client.
     * Returns empty Optional when the client has no orders.
     */
    @Query("SELECT o.receivedAt FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL ORDER BY o.receivedAt DESC LIMIT 1")
    Optional<Instant> findLastOrderCreatedAtByClientId(@Param("clientId") UUID clientId);
}
