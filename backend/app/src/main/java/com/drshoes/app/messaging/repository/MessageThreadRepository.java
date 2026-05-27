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
    Optional<MessageThreadEntity> findFirstByClientIdAndChannelAndDiscardedAtIsNullOrderByLastMessageAtDesc(
            UUID clientId, String channel);
    Optional<MessageThreadEntity> findFirstByRawSenderAndChannelAndDiscardedAtIsNull(
            String rawSender, String channel);
    List<MessageThreadEntity> findAllByClientIdIsNullAndDiscardedAtIsNullOrderByLastMessageAtDesc();
    List<MessageThreadEntity> findAllByClientIdAndDiscardedAtIsNullOrderByLastMessageAtDesc(UUID clientId);
    long countByClientIdAndUnreadCountGreaterThan(UUID clientId, int min);
    long countByClientIdAndDiscardedAtIsNullAndUnreadCountGreaterThan(UUID clientId, int min);
    List<MessageThreadEntity> findAllByClientIdAndUnreadCountGreaterThan(UUID clientId, int minCount);
    long countByUnreadCountGreaterThan(int min);
    Optional<MessageThreadEntity> findFirstByClientIdAndChannelOrderByCreatedAtAsc(
            UUID clientId, String channel);
    Optional<MessageThreadEntity> findFirstByRawSenderAndChannelOrderByCreatedAtAsc(
            String rawSender, String channel);
    @Query(value = """
        SELECT * FROM message_thread
        WHERE discarded_at IS NULL
          AND (:channel IS NULL OR channel = :channel)
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 50
        """, nativeQuery = true)
    List<MessageThreadEntity> findAllActiveOrderByLastMessageAtDesc(@Param("channel") String channel);
    @Query(value = """
        SELECT * FROM message_thread
        WHERE discarded_at IS NULL AND unread_count > 0
          AND (:channel IS NULL OR channel = :channel)
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 50
        """, nativeQuery = true)
    List<MessageThreadEntity> findAllWithUnreadOrderByLastMessageAtDesc(@Param("channel") String channel);
    @Query(value = """
        SELECT * FROM message_thread
        WHERE discarded_at IS NULL AND client_id IS NULL
          AND (:channel IS NULL OR channel = :channel)
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 50
        """, nativeQuery = true)
    List<MessageThreadEntity> findAllUnmatchedOrderByLastMessageAtDesc(@Param("channel") String channel);
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
