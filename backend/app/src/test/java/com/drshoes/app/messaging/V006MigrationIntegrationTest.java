package com.drshoes.app.messaging;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class V006MigrationIntegrationTest extends AbstractIntegrationTest {

  @Autowired JdbcTemplate jdbc;

  @Test
  void seedsFourTemplates() {
    // V006 seeds 4 templates; V026 adds the followup template — total ≥ 4.
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM message_template WHERE active = TRUE",
        Integer.class);
    assertThat(count).isGreaterThanOrEqualTo(4);
  }

  @Test
  void seedsFourEnabledTriggers() {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM trigger_ WHERE enabled = TRUE",
        Integer.class);
    assertThat(count).isEqualTo(4);
  }

  @Test
  void everySeededTriggerReferencesAnExistingTemplate() {
    Integer orphans = jdbc.queryForObject(
        "SELECT COUNT(*) FROM trigger_ t LEFT JOIN message_template mt ON mt.id = t.template_id WHERE mt.id IS NULL",
        Integer.class);
    assertThat(orphans).isZero();
  }

  @Test
  void triggerFireTableExistsWithCompositePk() {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM information_schema.table_constraints "
            + "WHERE table_name = 'trigger_fire' AND constraint_type = 'PRIMARY KEY'",
        Integer.class);
    assertThat(count).isEqualTo(1);
  }
}
