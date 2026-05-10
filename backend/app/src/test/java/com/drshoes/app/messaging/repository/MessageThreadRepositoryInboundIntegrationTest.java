package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Repository-level integration tests for V012 inbound finder methods.
 * Each test creates its own client + thread fixtures via JdbcTemplate for speed.
 */
@Transactional
class MessageThreadRepositoryInboundIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MessageThreadRepository repo;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID clientId;

    @BeforeEach
    void seedClient() {
        clientId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Repo', 'Test', ?, '+48111000001', 'EMAIL')",
                clientId.toString(), "repo-test-" + clientId + "@test.pl");
    }

    // ---- helper ----

    private UUID insertThread(UUID cId, String channel, String rawSender,
                              OffsetDateTime lastMessageAt, boolean discarded) {
        UUID id = UUID.randomUUID();
        OffsetDateTime discardedAt = discarded ? OffsetDateTime.now(ZoneOffset.UTC) : null;
        jdbc.update(
                "INSERT INTO message_thread (id, client_id, channel, raw_sender, last_message_at, discarded_at) " +
                "VALUES (?::uuid, ?::uuid, ?, ?, ?, ?)",
                id.toString(),
                cId != null ? cId.toString() : null,
                channel,
                rawSender,
                lastMessageAt,
                discardedAt);
        return id;
    }

    // ---- tests ----

    @Test
    @DisplayName("findFirstByClientIdAndChannel returns active thread and excludes discarded one")
    void findFirstByClientIdAndChannel_returnsMostRecent() {
        // V013 unique partial index allows only one active (non-discarded) thread per (client_id, channel).
        // Insert a discarded thread first, then the active one — finder must return only the active one.
        UUID discardedThread = insertThread(clientId, "EMAIL", null,
                OffsetDateTime.now(ZoneOffset.UTC).minusHours(2), true);
        UUID activeThread = insertThread(clientId, "EMAIL", null,
                OffsetDateTime.now(ZoneOffset.UTC).minusHours(1), false);

        var found = repo.findFirstByClientIdAndChannelAndDiscardedAtIsNullOrderByLastMessageAtDesc(
                clientId, "EMAIL");

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(activeThread);
        assertThat(found.get().getId()).isNotEqualTo(discardedThread);
    }

    @Test
    @DisplayName("findFirstByClientIdAndChannel excludes discarded threads")
    void findFirstByClientIdAndChannel_excludesDiscarded() {
        insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), true);

        var found = repo.findFirstByClientIdAndChannelAndDiscardedAtIsNullOrderByLastMessageAtDesc(
                clientId, "EMAIL");

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("findFirstByRawSenderAndChannel returns matching unmatched thread")
    void findFirstByRawSenderAndChannel_returnsMatch() {
        String rawSender = "+48500600700";
        insertThread(null, "SMS", rawSender, OffsetDateTime.now(ZoneOffset.UTC), false);

        var found = repo.findFirstByRawSenderAndChannelAndDiscardedAtIsNull(rawSender, "SMS");

        assertThat(found).isPresent();
        assertThat(found.get().getRawSender()).isEqualTo(rawSender);
        assertThat(found.get().getClientId()).isNull();
    }

    @Test
    @DisplayName("findAllByClientIdIsNullAndDiscardedAtIsNull lists only active unmatched threads")
    void findAllByClientIdIsNullAndDiscardedAtIsNull_listsAllUnmatched() {
        // matched thread — should NOT appear
        insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        // active unmatched — should appear
        UUID unmatchedActive = insertThread(null, "EMAIL", "unknown@example.com",
                OffsetDateTime.now(ZoneOffset.UTC), false);
        // discarded unmatched — should NOT appear
        insertThread(null, "SMS", "+48000000099",
                OffsetDateTime.now(ZoneOffset.UTC), true);

        List<MessageThreadEntity> result =
                repo.findAllByClientIdIsNullAndDiscardedAtIsNullOrderByLastMessageAtDesc();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(unmatchedActive);
    }

    @Test
    @DisplayName("countByClientIdAndUnreadCountGreaterThan skips threads with zero unread")
    void countByClientIdAndUnreadCountGreaterThan_skipsZero() {
        UUID threadWithUnread = insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        jdbc.update("UPDATE message_thread SET unread_count = 3 WHERE id = ?::uuid", threadWithUnread.toString());
        insertThread(clientId, "SMS", null, OffsetDateTime.now(ZoneOffset.UTC), false); // 0 unread

        long count = repo.countByClientIdAndUnreadCountGreaterThan(clientId, 0);

        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("countByUnreadCountGreaterThan aggregates across all clients")
    void countByUnreadCountGreaterThan_aggregates() {
        UUID otherClient = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Other', 'Client', ?, '+48222000002', 'EMAIL')",
                otherClient.toString(), "other-" + otherClient + "@test.pl");

        UUID t1 = insertThread(clientId, "EMAIL", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        UUID t2 = insertThread(otherClient, "SMS", null, OffsetDateTime.now(ZoneOffset.UTC), false);
        jdbc.update("UPDATE message_thread SET unread_count = 2 WHERE id = ?::uuid", t1.toString());
        jdbc.update("UPDATE message_thread SET unread_count = 1 WHERE id = ?::uuid", t2.toString());
        insertThread(clientId, "SMS", null, OffsetDateTime.now(ZoneOffset.UTC), false); // 0 unread

        long total = repo.countByUnreadCountGreaterThan(0);

        assertThat(total).isGreaterThanOrEqualTo(2);
    }

    @Test
    @DisplayName("native insert with both client_id and raw_sender NULL violates CHECK constraint")
    void nativeRepoBlocksDoubleNull() {
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message_thread (id, client_id, raw_sender, channel) " +
                "VALUES (?::uuid, NULL, NULL, 'EMAIL')",
                UUID.randomUUID().toString()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
