package com.drshoes.app.webhooks;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test for PostmarkInboundController — 6-case matrix:
 *
 *   1. Valid payload + known sender  → 200, INBOUND message row, unread_count=1, audit row
 *   2. Valid payload + unknown sender → 200, INBOUND row, thread.client_id NULL, raw_sender set
 *   3. Duplicate provider_message_id → 200, body duplicate=true, no second row
 *   4. Missing Basic Auth            → 401, no DB writes
 *   5. Wrong Basic Auth credentials  → 401, no DB writes
 *   6. strippedTextReply blank       → 200, message body falls back to textBody
 *
 * Named *IntegrationTest per project convention (*IT silently skipped by Maven Failsafe).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.email.postmark.webhook-username=drshoes",
    "messaging.email.postmark.webhook-secret=test-secret"
})
class PostmarkInboundControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc                  mockMvc;
    @Autowired MessageRepository        messages;
    @Autowired MessageThreadRepository  threads;
    @Autowired AuditLogRepository       auditLogs;
    @Autowired ClientRepository         clients;

    private static final String VALID_AUTH =
        "Basic " + Base64.getEncoder().encodeToString(
            "drshoes:test-secret".getBytes(StandardCharsets.UTF_8));
    private static final String BAD_AUTH =
        "Basic " + Base64.getEncoder().encodeToString(
            "drshoes:wrong-password".getBytes(StandardCharsets.UTF_8));

    private static final String ENDPOINT = "/api/webhooks/postmark/inbound";

    @AfterEach
    void tearDown() {
        // FK order: audit_log first, then messages, then threads, then clients
        auditLogs.deleteAll();
        messages.deleteAll();
        threads.deleteAll();
        clients.deleteAll();
    }

    // ── Case 1: Valid payload, known sender ──────────────────────────────────

    @Test
    void validPayload_matchedClient_returns200_recordsMessage_bumpsUnread() throws Exception {
        var client = new Client();
        client.setFirstName("Anna");
        client.setLastName("Kowalska");
        client.setEmail("anna@example.com");
        client.setPhone("+48600100200");
        clients.save(client);

        String msgId = "pm-inbound-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "anna@example.com", "Anna Kowalska",
            "Kiedy będzie gotowe?", "Kiedy będzie gotowe?", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // Exactly one INBOUND message row
        var inboundRows = messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList();
        assertThat(inboundRows).hasSize(1);
        assertThat(inboundRows.get(0).getProviderMessageId()).isEqualTo(msgId);

        // Thread unread_count = 1
        var thread = threads.findById(inboundRows.get(0).getThreadId()).orElseThrow();
        assertThat(thread.getUnreadCount()).isEqualTo(1);

        // Audit row with path = InboundMessageService#recordEmailInbound must be present
        // and parent_entity_id must equal the thread id (SpEL property access: #result.threadId).
        var auditRow = auditLogs.findAll().stream()
            .filter(a -> a.getPath() != null
                      && a.getPath().contains("InboundMessageService#recordEmailInbound"))
            .findFirst();
        assertThat(auditRow).isPresent();
        assertThat(auditRow.get().getParentEntityId()).isEqualTo(thread.getId());
    }

    // ── Case 2: Unknown sender → unmatched / raw_sender set ─────────────────

    @Test
    void validPayload_unmatchedSender_recordsRawSenderThread() throws Exception {
        String msgId = "pm-inbound-unmatched-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "stranger@example.com", "Random Person",
            "Hej, ile kosztuje?", "Hej, ile kosztuje?", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        var inboundRows = messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList();
        assertThat(inboundRows).hasSize(1);

        // Thread must have client_id=NULL, raw_sender=sender address
        var thread = threads.findById(inboundRows.get(0).getThreadId()).orElseThrow();
        assertThat(thread.getClientId()).isNull();
        assertThat(thread.getRawSender()).isEqualTo("stranger@example.com");

        // Message row must mirror raw_sender; client_id null
        assertThat(inboundRows.get(0).getClientId()).isNull();
        assertThat(inboundRows.get(0).getRawSender()).isEqualTo("stranger@example.com");
    }

    // ── Case 3: Duplicate provider_message_id → idempotent ──────────────────

    @Test
    void duplicateProviderMessageId_returns200_doesNotInsert() throws Exception {
        String msgId = "pm-inbound-dup-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "dup@example.com", "Dup Person",
            "Pierwsze wysłanie", "Pierwsze wysłanie", "");

        // First POST
        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        long countAfterFirst = messages.findAll().stream()
            .filter(m -> msgId.equals(m.getProviderMessageId()))
            .count();
        assertThat(countAfterFirst).isEqualTo(1);

        // Second POST — same messageId
        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(true));

        long countAfterSecond = messages.findAll().stream()
            .filter(m -> msgId.equals(m.getProviderMessageId()))
            .count();
        assertThat(countAfterSecond).isEqualTo(1); // no second row
    }

    // ── Case 4: Missing Authorization header → 401 ───────────────────────────

    @Test
    void missingBasicAuth_returns401() throws Exception {
        String payload = inboundJson("pm-noauth-" + UUID.randomUUID(), "x@example.com",
            "X", "body", "body", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isUnauthorized());

        assertThat(messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList()).isEmpty();
    }

    // ── Case 5: Wrong credentials → 401 ─────────────────────────────────────

    @Test
    void wrongBasicAuth_returns401() throws Exception {
        String payload = inboundJson("pm-badauth-" + UUID.randomUUID(), "x@example.com",
            "X", "body", "body", "");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", BAD_AUTH)
                .content(payload))
            .andExpect(status().isUnauthorized());

        assertThat(messages.findAll().stream()
            .filter(m -> "INBOUND".equals(m.getDirection()))
            .toList()).isEmpty();
    }

    // ── Case 6: strippedTextReply blank → falls back to textBody ─────────────

    @Test
    void strippedTextReplyEmpty_fallsBackToTextBody() throws Exception {
        String msgId = "pm-fallback-" + UUID.randomUUID();
        String payload = inboundJson(msgId, "fallback@example.com", "Fallback Person",
            /* textBody */ "Pełna treść wiadomości",
            /* strippedReply (blank) */ "",
            /* subject */ "Zapytanie");

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", VALID_AUTH)
                .content(payload))
            .andExpect(status().isOk());

        var inboundRows = messages.findAll().stream()
            .filter(m -> msgId.equals(m.getProviderMessageId()))
            .toList();
        assertThat(inboundRows).hasSize(1);
        // Body must equal textBody because strippedTextReply was blank
        assertThat(inboundRows.get(0).getBody()).isEqualTo("Pełna treść wiadomości");
    }

    // ── helper ───────────────────────────────────────────────────────────────

    /**
     * Builds a minimal Postmark inbound JSON payload.
     * strippedTextReply may be blank string (not null) to test fallback.
     */
    private String inboundJson(String messageId, String from, String fromName,
                                String textBody, String strippedTextReply, String subject) {
        return """
            {
              "MessageID": "%s",
              "From": "%s",
              "FromName": "%s",
              "To": "drshoes@inbound.postmarkapp.com",
              "Subject": "%s",
              "TextBody": "%s",
              "StrippedTextReply": "%s",
              "Date": "2026-05-10T10:00:00Z"
            }
            """.formatted(messageId, from, fromName, subject, textBody, strippedTextReply);
    }
}
