package com.drshoes.app.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    /**
     * Fetches all audit_log rows relevant to a given orderId for timeline composition.
     *
     * Two kinds of rows are returned:
     *   1. HTTP rows: path starts with /api/admin/orders/{orderId}/ or equals
     *      /api/admin/orders/{orderId} (covers STATUS_CHANGED, ORDER_UPDATED,
     *      ORDER_SOFT_DELETED, item HTTP rows — the curator skips item HTTP rows).
     *   2. INTERNAL rows: parentEntityId = orderId (covers ITEM_ADDED, ITEM_EDITED,
     *      ITEM_REMOVED written by @Audited aspect on OrderService methods).
     *
     * NOTE: The ORDER_CREATED row (POST /api/admin/orders, no UUID in path) is NOT
     * returned here. ORDER_CREATED is synthesised from Order.createdAt in
     * AuditTimelineService. This is acknowledged M1 debt — actor for ORDER_CREATED
     * is "—". See dispatch-log for full rationale.
     *
     * Ordered by createdAt ASC so the service can flatMap + sort trivially.
     */
    @Query("SELECT a FROM AuditLog a " +
           "WHERE a.path LIKE :pathPrefix " +
           "   OR a.parentEntityId = :orderId " +
           "ORDER BY a.createdAt ASC")
    List<AuditLog> findOrderTimelineRows(
            @Param("pathPrefix") String pathPrefix,
            @Param("orderId") UUID orderId);
}
