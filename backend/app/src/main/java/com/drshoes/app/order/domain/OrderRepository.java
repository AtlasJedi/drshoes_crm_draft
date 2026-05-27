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
import lombok.Getter;
import lombok.Setter;

public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {
    Optional<Order> findByCode(String code);
    Page<Order> findAllByDeletedAtIsNull(Pageable pageable);
    @Query(value = """
            SELECT * FROM order_
            WHERE deleted_at IS NULL
              AND planned_pickup_at IS NOT NULL
              AND (planned_pickup_at AT TIME ZONE 'Europe/Warsaw')::date = :targetDate
            """, nativeQuery = true)
    List<Order> findAllByPlannedPickupDate(@Param("targetDate") LocalDate targetDate);
    @Query(value = """
            SELECT * FROM order_
            WHERE deleted_at IS NULL
              AND picked_up_at IS NOT NULL
              AND (picked_up_at AT TIME ZONE 'Europe/Warsaw')::date = :targetDate
            """, nativeQuery = true)
    List<Order> findAllByPickedUpDate(@Param("targetDate") LocalDate targetDate);
    @Query("SELECT COUNT(o) FROM Order o WHERE o.status = :status AND o.deletedAt IS NULL")
    long countByStatusNotDeleted(@Param("status") OrderStatus status);
    @Query("SELECT COUNT(o) FROM Order o WHERE o.deletedAt IS NULL AND o.receivedAt >= :from AND o.receivedAt < :to")
    long countReceivedBetween(@Param("from") Instant from, @Param("to") Instant to);
    @Query("SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.receivedAt >= :from AND o.receivedAt < :to")
    long sumRevenueBetween(@Param("from") Instant from, @Param("to") Instant to);
    @Query("SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.status IN :statuses")
    long sumTotalPriceByStatusIn(@Param("statuses") java.util.Set<OrderStatus> statuses);
    @Query("SELECT COALESCE(SUM(o.totalPriceCents), 0) FROM Order o WHERE o.deletedAt IS NULL AND o.status = com.drshoes.app.order.domain.OrderStatus.WYDANE AND o.pickedUpAt >= :from AND o.pickedUpAt < :to")
    long sumTotalPricePickedUpBetween(@Param("from") Instant from, @Param("to") Instant to);
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
    @Query(value = """
        SELECT oi.kind AS kind, COUNT(*) AS cnt
        FROM order_item oi
        JOIN order_ o ON o.id = oi.order_id
        WHERE o.deleted_at IS NULL
          AND o.status NOT IN ('WYDANE','ANULOWANE','GOTOWE_DO_ODBIORU')
        GROUP BY oi.kind
        """, nativeQuery = true)
    List<Object[]> countByItemKind();
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
    @Query(value = """
        SELECT * FROM order_
        WHERE deleted_at IS NULL
          AND planned_pickup_at IS NULL
          AND status NOT IN ('WYDANE', 'ANULOWANE')
        ORDER BY received_at DESC
        LIMIT 50
        """, nativeQuery = true)
    List<Order> findUnscheduled();
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
    @Query(value = """
        SELECT * FROM order_
        WHERE status = :status AND deleted_at IS NULL
        ORDER BY received_at DESC
        LIMIT :lim
        """, nativeQuery = true)
    List<Order> findTopByStatusOrderByReceivedAtDesc(@Param("status") String status,
                                                     @Param("lim") int lim);
    @Query(value = """
        SELECT * FROM order_
        WHERE status = 'WYDANE' AND deleted_at IS NULL
        ORDER BY picked_up_at DESC NULLS LAST
        LIMIT :lim
        """, nativeQuery = true)
    List<Order> findTopWydaneOrderByPickedUpAtDesc(@Param("lim") int lim);
    @Query("SELECT COUNT(o) FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL")
    long countByClientIdAndDeletedAtIsNull(@Param("clientId") UUID clientId);
    @Query("SELECT COUNT(o) FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL AND o.status IN :statuses")
    long countByClientIdAndStatusInAndDeletedAtIsNull(@Param("clientId") UUID clientId,
                                                      @Param("statuses") List<OrderStatus> statuses);
    @Query("SELECT o.receivedAt FROM Order o WHERE o.clientId = :clientId AND o.deletedAt IS NULL ORDER BY o.receivedAt DESC LIMIT 1")
    Optional<Instant> findLastOrderCreatedAtByClientId(@Param("clientId") UUID clientId);
}
