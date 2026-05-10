package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.MessageThreadEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageThreadRepository extends JpaRepository<MessageThreadEntity, UUID> {
    Optional<MessageThreadEntity> findFirstByClientIdOrderByCreatedAtAsc(UUID clientId);

    /**
     * Returns the most recent non-discarded thread for a known client + channel.
     * Used by InboundMessageService to route matched inbound messages.
     */
    Optional<MessageThreadEntity> findFirstByClientIdAndChannelAndDiscardedAtIsNullOrderByLastMessageAtDesc(
            UUID clientId, String channel);

    /**
     * Returns the non-discarded thread for an unmatched sender + channel, if one exists.
     * Used by InboundMessageService to group repeated unmatched inbound messages.
     */
    Optional<MessageThreadEntity> findFirstByRawSenderAndChannelAndDiscardedAtIsNull(
            String rawSender, String channel);

    /**
     * Returns all non-discarded unmatched threads (client_id IS NULL), ordered newest-first.
     * Used by ThreadController to populate the "Niesparowane" filter.
     */
    List<MessageThreadEntity> findAllByClientIdIsNullAndDiscardedAtIsNullOrderByLastMessageAtDesc();

    /**
     * Counts non-discarded threads for a client that have at least one unread message.
     * Used by OrderDrawer banner to detect "unread elsewhere".
     */
    long countByClientIdAndUnreadCountGreaterThan(UUID clientId, int min);

    /**
     * Counts all non-discarded threads system-wide with unread messages.
     * Used by MessagesNavItem sidebar badge.
     */
    long countByUnreadCountGreaterThan(int min);

    /**
     * Returns the earliest thread for a known client + channel (no discard filter).
     * Used by MessageThreadService.findOrCreateForClient(UUID, String) for simple find-or-create.
     */
    Optional<MessageThreadEntity> findFirstByClientIdAndChannelOrderByCreatedAtAsc(
            UUID clientId, String channel);

    /**
     * Returns the earliest unmatched thread for a raw sender + channel (no discard filter).
     * Used by MessageThreadService.findOrCreateForRawSender for simple find-or-create.
     */
    Optional<MessageThreadEntity> findFirstByRawSenderAndChannelOrderByCreatedAtAsc(
            String rawSender, String channel);

    /** Active = not discarded. Optionally filtered by channel. */
    @Query(value = """
        SELECT * FROM message_thread
        WHERE discarded_at IS NULL
          AND (:channel IS NULL OR channel = :channel)
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 50
        """, nativeQuery = true)
    List<MessageThreadEntity> findAllActiveOrderByLastMessageAtDesc(@Param("channel") String channel);

    /** Unread = not discarded, unread_count > 0. Optionally filtered by channel. */
    @Query(value = """
        SELECT * FROM message_thread
        WHERE discarded_at IS NULL AND unread_count > 0
          AND (:channel IS NULL OR channel = :channel)
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 50
        """, nativeQuery = true)
    List<MessageThreadEntity> findAllWithUnreadOrderByLastMessageAtDesc(@Param("channel") String channel);

    /** Unmatched = not discarded, client_id IS NULL. Optionally filtered by channel. */
    @Query(value = """
        SELECT * FROM message_thread
        WHERE discarded_at IS NULL AND client_id IS NULL
          AND (:channel IS NULL OR channel = :channel)
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 50
        """, nativeQuery = true)
    List<MessageThreadEntity> findAllUnmatchedOrderByLastMessageAtDesc(@Param("channel") String channel);

    /**
     * Full-text search: matches client name/phone/email, raw_sender, or latest 3 message bodies.
     * Uses a subquery inside EXISTS for body search (Postgres 9.3+ compatible, no LATERAL keyword needed).
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM message_thread t
        LEFT JOIN client c ON c.id = t.client_id
        WHERE t.discarded_at IS NULL
          AND (:channel IS NULL OR t.channel = :channel)
          AND (
               c.first_name ILIKE '%' || :q || '%'
            OR c.last_name  ILIKE '%' || :q || '%'
            OR c.phone      ILIKE '%' || :q || '%'
            OR c.email      ILIKE '%' || :q || '%'
            OR t.raw_sender ILIKE '%' || :q || '%'
            OR EXISTS (
                 SELECT 1 FROM (
                   SELECT body FROM message
                   WHERE thread_id = t.id
                   ORDER BY created_at DESC
                   LIMIT 3
                 ) recent
                 WHERE recent.body ILIKE '%' || :q || '%'
               )
          )
        ORDER BY t.last_message_at DESC NULLS LAST
        LIMIT 50
        """, nativeQuery = true)
    List<MessageThreadEntity> searchThreads(@Param("q") String q, @Param("channel") String channel);
}
