package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.MessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {

    List<MessageEntity> findAllByOrderIdOrderByCreatedAtAsc(UUID orderId);

    /**
     * Finds a message by its provider-assigned message ID and channel.
     * Used by WebhookStatusReconciler to correlate inbound webhook callbacks
     * to the outbound message row.
     */
    @Query("SELECT m FROM MessageEntity m WHERE m.providerMessageId = :providerMessageId AND m.channel = :channel")
    Optional<MessageEntity> findByProviderMessageIdAndChannel(
            @Param("providerMessageId") String providerMessageId,
            @Param("channel") String channel);

    /**
     * State-guarded UPDATE: advances delivery_status from SENT to the target status.
     * Returns 1 if the row was updated, 0 if it was already at the target status
     * or not in SENT state (no-op / idempotent).
     *
     * Only rows in SENT status are eligible for transition; this prevents a
     * later webhook from overwriting a FAILED status back to DELIVERED or vice-versa.
     */
    @Modifying
    @Query("""
        UPDATE MessageEntity m
        SET m.deliveryStatus = :status,
            m.errorCode      = :errorCode,
            m.errorMessage   = :errorMessage,
            m.deliveredAt    = :deliveredAt
        WHERE m.id = :id AND m.deliveryStatus = 'SENT'
        """)
    int reconcileDeliveryStatus(
            @Param("id")            UUID id,
            @Param("status")        String status,
            @Param("errorCode")     String errorCode,
            @Param("errorMessage")  String errorMessage,
            @Param("deliveredAt")   java.time.OffsetDateTime deliveredAt);
}
