package com.drshoes.app.webhooks;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for SmsApiInboundController — 6-case matrix.
 *
 * Allowlist: 198.18.0.1 (injected via TestPropertySource).
 * IP header: Cf-Connecting-Ip (hardcoded in the controller — not configurable).
 *
 * Named *IntegrationTest (NOT *IT) per project convention.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "messaging.sms.smsapi.allowlist=198.18.0.1"
})
class SmsApiInboundControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired MockMvc               mockMvc;
    @Autowired ClientRepository      clients;
    @Autowired MessageRepository     messages;
    @Autowired MessageThreadRepository threads;

    private static final String ALLOWED_IP = "198.18.0.1";
    private static final String CLIENT_PHONE_STORED = "+48506220119";

    @BeforeEach
    void setUp() {
        var client = new Client();
        client.setFirstName("Inbound");
        client.setLastName("Tester");
        client.setPhone(CLIENT_PHONE_STORED);
        clients.save(client);
    }

    @AfterEach
    void tearDown() {
        messages.deleteAll();
        threads.deleteAll();
        clients.deleteAll();
    }

    // ── Case 1: matched client, phone with spaces ─────────────────────────────

    @Test
    void validPayload_matchedClient_phoneNormalized() throws Exception {
        // sms_from with spaces — normalizer should strip to "+48506220119"
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   "sms-match-" + System.nanoTime())
                .param("sms_from", "+48 506 220 119")
                .param("sms_to",   "+48123456789")
                .param("sms_text", "Kiedy bedzie gotowe?")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // A thread for the matched client must have been created/found
        assertThat(threads.findAll()).isNotEmpty();
        var thread = threads.findAll().get(0);
        assertThat(thread.getClientId()).isNotNull();
    }

    // ── Case 2: unmatched sender — raw_sender thread ─────────────────────────

    @Test
    void validPayload_unmatchedSender_rawSenderThread() throws Exception {
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   "sms-unmatched-" + System.nanoTime())
                .param("sms_from", "+48999888777")   // no matching client
                .param("sms_text", "Kto to jest?")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // Thread must exist with null clientId and non-null rawSender
        assertThat(threads.findAll()).isNotEmpty();
        var thread = threads.findAll().get(0);
        assertThat(thread.getClientId()).isNull();
        assertThat(thread.getRawSender()).isEqualTo("+48999888777");
    }

    // ── Case 3: duplicate smsId — 200 no second insert ───────────────────────

    @Test
    void duplicateSmsId_returns200_noSecondInsert() throws Exception {
        String smsId = "sms-dup-" + System.nanoTime();

        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   smsId)
                .param("sms_from", "+48506220119")
                .param("sms_text", "First")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(false));

        // Replay with same smsId
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   smsId)
                .param("sms_from", "+48506220119")
                .param("sms_text", "Replay")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.duplicate").value(true));

        // Only one message row in DB
        assertThat(messages.findAll()).hasSize(1);
    }

    // ── Case 4: IP not in allowlist → 403 ────────────────────────────────────

    @Test
    void ipNotInAllowlist_returns403() throws Exception {
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", "1.2.3.4")   // not in allowlist
                .param("sms_id",   "sms-forbidden-" + System.nanoTime())
                .param("sms_from", "+48506220119")
                .param("sms_text", "Hack")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isForbidden());

        assertThat(messages.findAll()).isEmpty();
        assertThat(threads.findAll()).isEmpty();
    }

    // ── Case 5: missing Cf-Connecting-Ip header → 403 fail-closed ────────────

    @Test
    void cfConnectingIpHeaderMissing_returns403_failClosed() throws Exception {
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                // No Cf-Connecting-Ip header
                .param("sms_id",   "sms-noheader-" + System.nanoTime())
                .param("sms_from", "+48506220119")
                .param("sms_text", "Test")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isForbidden());

        assertThat(messages.findAll()).isEmpty();
    }

    // ── Case 6: bare phone format (no +48) routes via normalizer ─────────────

    @Test
    void barePhoneFormat_routesViaNormalizer() throws Exception {
        // "506220119" — no country code prefix; normalizer should prepend +48
        // and match the client whose phone is stored as "+48506220119"
        mockMvc.perform(post("/api/webhooks/smsapi/inbound")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header("Cf-Connecting-Ip", ALLOWED_IP)
                .param("sms_id",   "sms-bare-" + System.nanoTime())
                .param("sms_from", "506220119")
                .param("sms_text", "Jak tam?")
                .param("sms_date", String.valueOf(System.currentTimeMillis() / 1000)))
            .andExpect(status().isOk());

        // Thread must be matched (clientId not null) — normalizer resolved to +48 prefix
        assertThat(threads.findAll()).isNotEmpty();
        var thread = threads.findAll().get(0);
        assertThat(thread.getClientId()).isNotNull();
    }
}
