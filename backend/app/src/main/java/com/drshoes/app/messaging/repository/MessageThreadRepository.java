package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.MessageThreadEntity;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
