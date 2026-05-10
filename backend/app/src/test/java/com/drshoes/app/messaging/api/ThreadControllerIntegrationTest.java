package com.drshoes.app.messaging.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class ThreadControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MessageThreadRepository threadRepo;
    @Autowired ClientRepository clientRepo;
    @Autowired MessageRepository messageRepo;

    private UUID clientId;
    private UUID unmatchedThreadId;
    private UUID matchedThreadId;

    @AfterEach
    void tearDown() {
        // FK order: messages → threads → clients
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();
    }

    @BeforeEach
    void setUp() {
        messageRepo.deleteAll();
        threadRepo.deleteAll();
        clientRepo.deleteAll();

        var client = new Client();
        client.setFirstName("Anna");
        client.setLastName("Kowalska");
        client.setEmail("anna@example.com");
        client.setPhone("+48600100200");
        clientId = clientRepo.save(client).getId();

        var matched = new MessageThreadEntity();
        matched.setClientId(clientId);
        matched.setChannel("EMAIL");
        matched.setUnreadCount(3);
        matchedThreadId = threadRepo.save(matched).getId();

        var unmatched = new MessageThreadEntity();
        unmatched.setRawSender("+48999888777");
        unmatched.setChannel("SMS");
        unmatched.setUnreadCount(1);
        unmatchedThreadId = threadRepo.save(unmatched).getId();

        // Seed one INBOUND message on the unmatched thread (for assign bulk-update assertion)
        var inboundMsg = MessageEntity.newMessage();
        inboundMsg.setThreadId(unmatchedThreadId);
        inboundMsg.setRawSender("+48999888777");
        inboundMsg.setDirection("INBOUND");
        inboundMsg.setChannel("SMS");
        inboundMsg.setBody("hello");
        // clientId is intentionally null — that's the bulk-update target
        messageRepo.save(inboundMsg);
    }

    @Test
    @DisplayName("GET /threads?filter=ALL returns both matched and unmatched threads")
    void list_filterAll() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("filter", "ALL")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("GET /threads?filter=UNREAD returns only threads with unreadCount > 0")
    void list_filterUnread() throws Exception {
        var zeroRead = new MessageThreadEntity();
        zeroRead.setClientId(clientId);
        zeroRead.setChannel("SMS");
        zeroRead.setUnreadCount(0);
        threadRepo.save(zeroRead);

        mockMvc.perform(get("/api/admin/threads").param("filter", "UNREAD")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));  // Fix-up B: matched(3) + unmatched(1), zeroRead excluded
    }

    @Test
    @DisplayName("GET /threads?filter=UNMATCHED returns only threads with clientId=null")
    void list_filterUnmatched() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("filter", "UNMATCHED")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].unmatched").value(true));
    }

    @Test
    @DisplayName("GET /threads?q=Anna matches on client firstName")
    void list_searchByClientName() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("q", "Anna")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].clientId").value(clientId.toString()));
    }

    @Test
    @DisplayName("GET /threads?q=999 matches on rawSender of unmatched thread")
    void list_searchByRawSender() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("q", "999")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].unmatched").value(true))
            .andExpect(jsonPath("$[0].rawSender").value("+48999888777"));
    }

    @Test
    @DisplayName("GET /threads?q=600100 matches on client phone")
    void list_searchByClientPhone() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("q", "600100")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].clientId").value(clientId.toString()));
    }

    @Test
    @DisplayName("GET /threads?q=anna@example matches on client email")
    void list_searchByClientEmail() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("q", "anna@example")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].clientId").value(clientId.toString()));
    }

    @Test
    @DisplayName("GET /threads?q=X (1 char) ignores q — returns all")
    void list_shortQueryIgnored() throws Exception {
        mockMvc.perform(get("/api/admin/threads").param("q", "X")
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("GET /threads/{id} returns thread detail with messages list")
    void getThread_found() throws Exception {
        mockMvc.perform(get("/api/admin/threads/{id}", matchedThreadId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.thread.id").value(matchedThreadId.toString()))
            .andExpect(jsonPath("$.messages").isArray());
    }

    @Test
    @DisplayName("GET /threads/{id} returns 404 for unknown id")
    void getThread_notFound() throws Exception {
        mockMvc.perform(get("/api/admin/threads/{id}", UUID.randomUUID())
                .with(owner()))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /threads/{id}/mark-read sets unreadCount to 0")
    void markRead_setsZero() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/mark-read", matchedThreadId)
                .with(owner()).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unreadCount").value(0));

        assertThat(threadRepo.findById(matchedThreadId))
            .get().extracting(MessageThreadEntity::getUnreadCount).isEqualTo(0);
    }

    @Test
    @DisplayName("POST /threads/{id}/assign moves thread to client")
    void assign_happy() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/assign", unmatchedThreadId)
                .with(owner()).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"clientId": "%s"}
                    """.formatted(clientId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clientId").value(clientId.toString()))
            .andExpect(jsonPath("$.unmatched").value(false));

        // Fix-up A: assert bulk-update propagated clientId to message rows
        var msgs = messageRepo.findAllByThreadIdOrderByCreatedAtAsc(unmatchedThreadId);
        assertThat(msgs).hasSizeGreaterThanOrEqualTo(1);
        assertThat(msgs).allSatisfy(m -> assertThat(m.getClientId()).isEqualTo(clientId));
    }

    @Test
    @DisplayName("POST /threads/{id}/assign returns 409 when already assigned")
    void assign_alreadyAssigned() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/assign", matchedThreadId)
                .with(owner()).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"clientId": "%s"}
                    """.formatted(clientId)))
            .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("POST /threads/{id}/discard sets discardedAt")
    void discard_happy() throws Exception {
        mockMvc.perform(post("/api/admin/threads/{id}/discard", unmatchedThreadId)
                .with(owner()).with(csrf()))
            .andExpect(status().isOk());

        assertThat(threadRepo.findById(unmatchedThreadId))
            .get().extracting(MessageThreadEntity::getDiscardedAt).isNotNull();
    }

    @Test
    @DisplayName("POST /threads/{id}/discard returns 409 when already discarded")
    void discard_alreadyDiscarded() throws Exception {
        // first discard
        mockMvc.perform(post("/api/admin/threads/{id}/discard", unmatchedThreadId)
                .with(owner()).with(csrf())).andExpect(status().isOk());
        // second attempt
        mockMvc.perform(post("/api/admin/threads/{id}/discard", unmatchedThreadId)
                .with(owner()).with(csrf()))
            .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("GET /threads returns 401 for anonymous request")
    void list_anonymous_401() throws Exception {
        mockMvc.perform(get("/api/admin/threads"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /threads returns 403 for PUBLIC role")
    void list_publicRole_403() throws Exception {
        mockMvc.perform(get("/api/admin/threads")
                .with(SecurityMockMvcRequestPostProcessors.user("u").roles("PUBLIC")))
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/admin/threads?clientId= returns only threads for that client")
    void listByClientIdReturnsMatchedThreadsOnly() throws Exception {
        // Seed a second client with its own thread — must NOT appear in filtered result.
        var otherClient = new Client();
        otherClient.setFirstName("Other");
        otherClient.setEmail("other@example.com");
        otherClient.setPhone("+48500000999");
        UUID otherClientId = clientRepo.save(otherClient).getId();

        var otherThread = new MessageThreadEntity();
        otherThread.setClientId(otherClientId);
        otherThread.setChannel("SMS");
        otherThread.setUnreadCount(0);
        threadRepo.save(otherThread);

        // Request threads for the seeded clientId — should return only matchedThread.
        mockMvc.perform(get("/api/admin/threads?clientId=" + clientId)
                .with(owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].clientId").value(clientId.toString()));
    }

    // ---- helpers ----

    /**
     * Injects an AdminPrincipal-backed authentication so that
     * {@code @AuthenticationPrincipal AdminPrincipal actor} resolves in controllers.
     * Uses a synthetic UUID since no DB user is required for these tests.
     */
    private static RequestPostProcessor owner() {
        var principal = new AdminPrincipal(
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "owner@drshoes.pl", "OWNER");
        var auth = UsernamePasswordAuthenticationToken.authenticated(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        return authentication(auth);
    }
}
