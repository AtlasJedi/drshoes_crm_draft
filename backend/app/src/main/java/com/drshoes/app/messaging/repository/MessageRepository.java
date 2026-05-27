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
    @Query("SELECT m FROM MessageEntity m WHERE m.providerMessageId = :providerMessageId AND m.channel = :channel")
    Optional<MessageEntity> findByProviderMessageIdAndChannel(
            @Param("providerMessageId") String providerMessageId,
            @Param("channel") String channel);
    @Modifying
    @Query("UPDATE MessageEntity m SET m.clientId = :clientId, m.rawSender = null WHERE m.threadId = :threadId")
    void bulkUpdateClientIdByThreadId(@Param("threadId") UUID threadId, @Param("clientId") UUID clientId);
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
    List<MessageEntity> findAllByThreadIdOrderByCreatedAtAsc(UUID threadId);
}
