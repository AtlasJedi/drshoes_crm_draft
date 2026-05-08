package com.drshoes.app.messaging.service;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MessageThreadServiceIntegrationTest extends AbstractIntegrationTest {

  @Autowired MessageThreadService svc;
  @Autowired MessageThreadRepository repo;
  @Autowired JdbcTemplate jdbc;

  // Track inserted client ids for @AfterEach cleanup.
  private final List<UUID> insertedClientIds = new ArrayList<>();

  /**
   * Inserts a minimal client row via JdbcTemplate and returns its id.
   * Minimal columns: id, first_name, phone (satisfies client_contact_present CHECK).
   */
  private UUID createClientAndReturnId() {
    UUID clientId = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO client (id, first_name, phone) VALUES (?::uuid, ?, ?)",
        clientId.toString(), "Test", "+48 600 000 000");
    insertedClientIds.add(clientId);
    return clientId;
  }

  @AfterEach
  void cleanup() {
    for (UUID clientId : insertedClientIds) {
      jdbc.update("DELETE FROM message_thread WHERE client_id = ?::uuid", clientId.toString());
      jdbc.update("DELETE FROM client WHERE id = ?::uuid", clientId.toString());
    }
    insertedClientIds.clear();
  }

  @Test
  void findOrCreateReturnsSameThreadForSameClient() {
    UUID clientId = createClientAndReturnId();
    var first = svc.findOrCreateForClient(clientId);
    var second = svc.findOrCreateForClient(clientId);
    assertThat(first.getId()).isEqualTo(second.getId());
    assertThat(repo.findFirstByClientIdOrderByCreatedAtAsc(clientId)).isPresent();
  }

  @Test
  void differentClientsGetDifferentThreads() {
    UUID a = createClientAndReturnId();
    UUID b = createClientAndReturnId();
    var ta = svc.findOrCreateForClient(a);
    var tb = svc.findOrCreateForClient(b);
    assertThat(ta.getId()).isNotEqualTo(tb.getId());
  }
}
