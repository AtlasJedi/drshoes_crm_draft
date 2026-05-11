package com.drshoes.app.audit;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that Flyway V014 applied the trace_id column correctly.
 * Uses information_schema.columns so the assertion is DB-agnostic for local Postgres +
 * Testcontainers-postgres (same schema introspection API).
 */
class AuditLogTraceIdMigrationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void v014_adds_trace_id_column_nullable_varchar32() {
        Integer count = jdbc.queryForObject("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'audit_log'
              AND column_name = 'trace_id'
              AND data_type = 'character varying'
              AND character_maximum_length = 32
              AND is_nullable = 'YES'
            """, Integer.class);

        assertThat(count)
            .as("audit_log.trace_id column must exist as varchar(32) nullable after V014")
            .isEqualTo(1);
    }
}
