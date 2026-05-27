package com.drshoes.app.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    @Query("SELECT a FROM AuditLog a " +
           "WHERE a.path LIKE :pathPrefix " +
           "   OR a.parentEntityId = :orderId " +
           "ORDER BY a.createdAt ASC")
    List<AuditLog> findOrderTimelineRows(
            @Param("pathPrefix") String pathPrefix,
            @Param("orderId") UUID orderId);
}
