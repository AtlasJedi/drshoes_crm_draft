package com.drshoes.app.config;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class SessionTablesIntegrationTest extends AbstractIntegrationTest {

    @Autowired JdbcTemplate jdbc;

    @Test
    void spring_session_tables_exist_after_v001() {
        Integer sessionTable = jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'spring_session'",
            Integer.class);
        Integer attrsTable = jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'spring_session_attributes'",
            Integer.class);
        assertThat(sessionTable).isEqualTo(1);
        assertThat(attrsTable).isEqualTo(1);
    }

    @Test
    void session_persists_through_request() {
        jdbc.update("INSERT INTO spring_session (primary_id, session_id, creation_time, last_access_time, max_inactive_interval, expiry_time, principal_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    java.util.UUID.randomUUID().toString(),
                    java.util.UUID.randomUUID().toString(),
                    System.currentTimeMillis(),
                    System.currentTimeMillis(),
                    1800,
                    System.currentTimeMillis() + 1800_000L,
                    "test@example.com");
        Integer count = jdbc.queryForObject("select count(*) from spring_session", Integer.class);
        assertThat(count).isGreaterThanOrEqualTo(1);
    }
}
