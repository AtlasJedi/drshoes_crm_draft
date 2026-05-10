package com.drshoes.app.messaging.api;

import com.drshoes.app.AdminWebTestBase;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for POST /api/admin/clients/{id}/messages (cross-thread compose).
 *
 * Extends AdminWebTestBase so real User rows exist in DB, satisfying FK constraints
 * on message.sent_by and audit_log.actor_id.
 *
 * Test cases: happy EMAIL, happy SMS, no email → 422, no phone → 422, unknown client → 404.
 * Delta: +5 tests.
 */
class ClientMessageControllerIntegrationTest extends AdminWebTestBase {

    @Autowired ClientRepository clientRepo;
    @Autowired MessageRepository messageRepo;
    @Autowired MessageThreadRepository threadRepo;

    private UUID clientWithBothId;
    private UUID clientEmailOnlyId;
    private UUID clientSmsOnlyId;

    @BeforeEach
    void setUpClients() {
        // AdminWebTestBase.seedUsers() runs first (clears audit+clients+users, seeds owner+emp)
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();

        var withBoth = new Client();
        withBoth.setFirstName("Piotr");
        withBoth.setLastName("Wiśniewski");
        withBoth.setEmail("piotr@example.com");
        withBoth.setPhone("+48700200300");
        clientWithBothId = clientRepo.save(withBoth).getId();

        var emailOnly = new Client();
        emailOnly.setFirstName("Maria");
        emailOnly.setLastName("Kowalczyk");
        emailOnly.setEmail("maria@example.com");
        clientEmailOnlyId = clientRepo.save(emailOnly).getId();

        var smsOnly = new Client();
        smsOnly.setFirstName("Tomasz");
        smsOnly.setLastName("Jabłoński");
        smsOnly.setPhone("+48800300400");
        clientSmsOnlyId = clientRepo.save(smsOnly).getId();

        loginAsOwner();
    }

    @AfterEach
    void tearDownClients() {
        // FK order: messages → threads → clients; AdminWebTestBase.cleanupUsers() runs after
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();
    }

    @Test
    @DisplayName("happy email compose — 200 + thread created + message created")
    void compose_email_happy() throws Exception {
        mockMvc().perform(post("/api/admin/clients/{id}/messages", clientWithBothId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","subject":"Zapraszamy","body":"Witamy!"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.direction").value("OUTBOUND"))
            .andExpect(jsonPath("$.channel").value("EMAIL"));

        assertThat(threadRepo.findFirstByClientIdAndChannelOrderByCreatedAtAsc(
            clientWithBothId, "EMAIL")).isPresent();
        assertThat(messageRepo.count()).isGreaterThan(0);
    }

    @Test
    @DisplayName("happy SMS compose — 200")
    void compose_sms_happy() throws Exception {
        mockMvc().perform(post("/api/admin/clients/{id}/messages", clientWithBothId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","subject":null,"body":"Cześć!"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.channel").value("SMS"));
    }

    @Test
    @DisplayName("client has no email → EMAIL compose returns 422")
    void compose_noEmail_422() throws Exception {
        mockMvc().perform(post("/api/admin/clients/{id}/messages", clientSmsOnlyId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Cześć!"}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("client has no phone → SMS compose returns 422")
    void compose_noPhone_422() throws Exception {
        mockMvc().perform(post("/api/admin/clients/{id}/messages", clientEmailOnlyId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"SMS","body":"Cześć!"}
                    """))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("unknown client → 404")
    void compose_unknownClient_404() throws Exception {
        mockMvc().perform(post("/api/admin/clients/{id}/messages", UUID.randomUUID())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"EMAIL","body":"Test"}
                    """))
            .andExpect(status().isNotFound());
    }
}
