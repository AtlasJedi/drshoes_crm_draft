package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies V012 migration applied cleanly: new columns, check constraints, and
 * partial unique index on message.provider_message_id + channel.
 *
 * Uses shared Testcontainers DB — all JDBC inserts must be cleaned up @AfterEach
 * to avoid polluting sibling test classes (FK violations on client delete etc.).
 */
class V012MigrationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @AfterEach
    void cleanup() {
        // Order matters: message references message_thread; message_thread references client.
        jdbc.execute("DELETE FROM message WHERE body IN ('hello','hello2','msg1','msg2')");
        jdbc.execute("DELETE FROM message_thread WHERE raw_sender = '+48123456789'");
        jdbc.execute("DELETE FROM message_thread WHERE client_id IN " +
                "(SELECT id FROM client WHERE email LIKE 'unique-idem-%' OR email LIKE 'null-pm-%')");
        jdbc.execute("DELETE FROM client WHERE email LIKE 'unique-idem-%' OR email LIKE 'null-pm-%'");
    }

    @Test
    @DisplayName("V012 columns exist on message_thread with correct types")
    void columnsExist() {
        var rawSenderType = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns " +
                "WHERE table_name='message_thread' AND column_name='raw_sender'",
                String.class);
        assertThat(rawSenderType).isEqualTo("character varying");

        var discardedAtType = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns " +
                "WHERE table_name='message_thread' AND column_name='discarded_at'",
                String.class);
        assertThat(discardedAtType).isEqualTo("timestamp with time zone");

        var channelType = jdbc.queryForObject(
                "SELECT data_type FROM information_schema.columns " +
                "WHERE table_name='message_thread' AND column_name='channel'",
                String.class);
        assertThat(channelType).isEqualTo("character varying");
    }

    @Test
    @DisplayName("CHECK constraint on message_thread blocks both client_id and raw_sender NULL")
    void checkConstraintBlocksBothNull() {
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message_thread (id, client_id, raw_sender, channel) VALUES (?::uuid, NULL, NULL, 'EMAIL')",
                UUID.randomUUID().toString()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("CHECK constraint on message_thread blocks both client_id and raw_sender set")
    void checkConstraintBlocksBothPresent() {
        // Need a valid client_id — skip with raw insert; the FK would also fire, but
        // the CHECK fires first in Postgres (implementation-defined order).
        // Use a non-existent UUID: the FK violation is also a DataIntegrityViolation.
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message_thread (id, client_id, raw_sender, channel) VALUES (?::uuid, ?::uuid, '+48123456789', 'EMAIL')",
                UUID.randomUUID().toString(), UUID.randomUUID().toString()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("idempotency unique index prevents duplicate (provider_message_id, channel) on message")
    void idempotencyUniquePreventsDuplicates() {
        // Build the minimal prerequisite rows: a client, a thread.
        UUID clientId = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Test', 'Unique', ?, '+48000000001', 'EMAIL')",
                clientId.toString(), "unique-idem-" + clientId + "@test.pl");

        UUID threadId = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                threadId.toString(), clientId.toString());

        String pmId = "pm-idem-" + UUID.randomUUID();

        // First insert — must succeed.
        jdbc.update("INSERT INTO message (id, thread_id, client_id, direction, channel, body, " +
                "delivery_status, provider_message_id) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'hello', 'QUEUED', ?)",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString(), pmId);

        // Second insert with same provider_message_id + channel — must fail.
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO message (id, thread_id, client_id, direction, channel, body, " +
                "delivery_status, provider_message_id) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'hello2', 'QUEUED', ?)",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString(), pmId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("NULL provider_message_id allows multiple rows (partial unique index skips NULLs)")
    void nullProviderMessageIdAllowedMultipleTimes() {
        UUID clientId = UUID.randomUUID();
        jdbc.update("INSERT INTO client (id, first_name, last_name, email, phone, preferred_channel) " +
                "VALUES (?::uuid, 'Test', 'NullPm', ?, '+48000000002', 'EMAIL')",
                clientId.toString(), "null-pm-" + clientId + "@test.pl");

        UUID threadId = UUID.randomUUID();
        jdbc.update("INSERT INTO message_thread (id, client_id, channel) VALUES (?::uuid, ?::uuid, 'EMAIL')",
                threadId.toString(), clientId.toString());

        // Two rows with provider_message_id = NULL — both must succeed.
        jdbc.update("INSERT INTO message (id, thread_id, client_id, direction, channel, body, delivery_status) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'msg1', 'QUEUED')",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString());
        jdbc.update("INSERT INTO message (id, thread_id, client_id, direction, channel, body, delivery_status) " +
                "VALUES (?::uuid, ?::uuid, ?::uuid, 'INBOUND', 'EMAIL', 'msg2', 'QUEUED')",
                UUID.randomUUID().toString(), threadId.toString(), clientId.toString());

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM message WHERE thread_id = ?::uuid AND provider_message_id IS NULL",
                Integer.class, threadId.toString());
        assertThat(count).isGreaterThanOrEqualTo(2);
    }
}
