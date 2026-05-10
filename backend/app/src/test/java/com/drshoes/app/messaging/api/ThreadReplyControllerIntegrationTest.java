package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for POST /api/admin/threads/{id}/messages (reply send).
 *
 * Extends AdminWebTestBase so real User rows exist in DB, satisfying FK constraints
 * on message.sent_by and audit_log.actor_id.
 *
 * Test cases: happy EMAIL, happy SMS, channel mismatch (400), unmatched thread (422),
 * discarded thread (422), unknown thread (404). Delta: +6 tests.
 */
class ThreadReplyControllerIntegrationTest extends AdminWebTestBase {

    @Autowired MessageThreadRepository threadRepo;
    @Autowired MessageRepository messageRepo;
    @Autowired ClientRepository clientRepo;

    private UUID emailThreadId;
    private UUID smsThreadId;
    private UUID unmatchedThreadId;
    private UUID discardedThreadId;

    @BeforeEach
    void setUpThreads() {
        // AdminWebTestBase.seedUsers() runs first (clears audit+clients+users, seeds owner+emp)
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();

        var client = new Client();
        client.setFirstName("Jan");
        client.setLastName("Nowak");
        client.setEmail("jan@example.com");
        client.setPhone("+48600100200");
        var clientId = clientRepo.save(client).getId();

        var emailThread = new MessageThreadEntity();
        emailThread.setClientId(clientId);
        emailThread.setChannel("EMAIL");
        emailThread.setUnreadCount(0);
        emailThreadId = threadRepo.save(emailThread).getId();

        var smsThread = new MessageThreadEntity();
        smsThread.setClientId(clientId);
        smsThread.setChannel("SMS");
        smsThread.setUnreadCount(0);
        smsThreadId = threadRepo.save(smsThread).getId();

        var unmatched = new MessageThreadEntity();
        unmatched.setRawSender("+48999888777");
        unmatched.setChannel("EMAIL");
        unmatched.setUnreadCount(0);
        unmatchedThreadId = threadRepo.save(unmatched).getId();

        var discarded = new MessageThreadEntity();
        discarded.setClientId(clientId);
        discarded.setChannel("SMS");
        discarded.setUnreadCount(0);
        discarded.setDiscardedAt(OffsetDateTime.now());
        discardedThreadId = threadRepo.save(discarded).getId();

        loginAsOwner();
    }

    @AfterEach
    void tearDownThreads() {
        // FK order: messages → threads → clients; AdminWebTestBase.cleanupUsers() runs after
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();
    }

    @Test
    @DisplayName("happy email reply — 200 + message row created")
    void reply_email_happy() throws Exception {
        mockMvc().perform(post("/api/admin/threads/{id}/messages", emailThreadId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","subject":"Re: Twoje zlecenie","body":"Gotowe, zapraszamy!","orderId":null}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.direction").value("OUTBOUND"))
            .andExpect(jsonPath("$.channel").value("EMAIL"));

        assertThat(messageRepo.findAllByThreadIdOrderByCreatedAtAsc(emailThreadId)).hasSize(1);
    }

    @Test
    @DisplayName("happy SMS reply — 200 + message row created")
    void reply_sms_happy() throws Exception {
        mockMvc().perform(post("/api/admin/threads/{id}/messages", smsThreadId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","subject":null,"body":"Gotowe!","orderId":null}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.channel").value("SMS"));
    }

    @Test
    @DisplayName("channel mismatch → 400")
    void reply_channelMismatch_400() throws Exception {
        mockMvc().perform(post("/api/admin/threads/{id}/messages", emailThreadId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","body":"Cześć","orderId":null}
                    """))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("unmatched thread → 422")
    void reply_unmatched_422() throws Exception {
        mockMvc().perform(post("/api/admin/threads/{id}/messages", unmatchedThreadId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Hej","orderId":null}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("discarded thread → 422")
    void reply_discarded_422() throws Exception {
        mockMvc().perform(post("/api/admin/threads/{id}/messages", discardedThreadId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","body":"Hej","orderId":null}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("unknown thread → 404")
    void reply_notFound_404() throws Exception {
        mockMvc().perform(post("/api/admin/threads/{id}/messages", UUID.randomUUID())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Test","orderId":null}
                    """))
            .andExpect(status().isNotFound());
    }
}
