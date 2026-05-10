package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies V013 unique partial indexes on message_thread.
 *
 * Covers:
 *   - duplicate (channel, client_id) insert fails when client not discarded
 *   - duplicate (channel, raw_sender) insert fails when thread not discarded
 *   - discarded thread (discarded_at IS NOT NULL) does NOT block re-creation
 *   - different channel creates a separate thread without uniqueness conflict
 */
class MessageThreadUniquenessIntegrationTest extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    private UUID clientId;

    @BeforeEach
    void insertClient() {
        clientId = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
            "VALUES (?::uuid, 'Test', 'Unique', ?, '+48000000099', 'EMAIL')",
            clientId.toString(), "uniq-" + clientId + "@test.pl");
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM message_thread WHERE client_id = ?::uuid OR raw_sender LIKE 'uniq-%'",
                clientId.toString());
        jdbc.update("DELETE FROM client WHERE id = ?::uuid", clientId.toString());
    }

    // -----------------------------------------------------------------------
    // Matched-thread uniqueness (client_id, channel)
    // -----------------------------------------------------------------------

    @Test
    void duplicateMatchedThreadFails() {
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                t1.toString(), clientId.toString());

        UUID t2 = UUID.randomUUID();
        assertThatThrownBy(() ->
            jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                    t2.toString(), clientId.toString()))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void matchedThreadOnDifferentChannelSucceeds() {
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                t1.toString(), clientId.toString());

        UUID t2 = UUID.randomUUID();
        // SMS is a different channel — must not conflict with the EMAIL thread
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'SMS')",
                t2.toString(), clientId.toString());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message_thread WHERE client_id = ?::uuid", Integer.class, clientId.toString());
        assertThat(count).isEqualTo(2);
    }

    @Test
    void discardedMatchedThreadDoesNotBlockRecreation() {
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel, discarded_at) " +
                "VALUES (?::uuid, ?::uuid, 'EMAIL', now())", t1.toString(), clientId.toString());

        // t1 is discarded → partial index predicate (discarded_at IS NULL) excludes it
        UUID t2 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                t2.toString(), clientId.toString());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message_thread WHERE client_id = ?::uuid", Integer.class, clientId.toString());
        assertThat(count).isEqualTo(2);
    }

    // -----------------------------------------------------------------------
    // Unmatched-thread uniqueness (raw_sender, channel)
    // -----------------------------------------------------------------------

    @Test
    void duplicateUnmatchedThreadFails() {
        String sender = "uniq-sender@external.com";
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, raw_sender, channel) VALUES (?::uuid, ?, 'EMAIL')",
                t1.toString(), sender);

        UUID t2 = UUID.randomUUID();
        assertThatThrownBy(() ->
            jdbc.update("INSERT INTO message_thread (id, raw_sender, channel) VALUES (?::uuid, ?, 'EMAIL')",
                    t2.toString(), sender))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void discardedUnmatchedThreadDoesNotBlockRecreation() {
        String sender = "uniq-discarded@external.com";
        UUID t1 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, raw_sender, channel, discarded_at) " +
                "VALUES (?::uuid, ?, 'EMAIL', now())", t1.toString(), sender);

        UUID t2 = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, raw_sender, channel) VALUES (?::uuid, ?, 'EMAIL')",
                t2.toString(), sender);

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message_thread WHERE raw_sender = ?", Integer.class, sender);
        assertThat(count).isEqualTo(2);
    }
}
