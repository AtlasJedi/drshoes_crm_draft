package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SmsApiPayloadMapperTest {

    private static final String FROM = "DrShoes";

    // ── Case 1: basic SMS payload ─────────────────────────────────────────
    // TODO(plan-errata #6): plan used "idempotency_key" but SMSAPI docs use "idx"
    //   (with optional check_idx=1 for dedup). Verified against smsapi.pl/docs 2026-05-09.
    @Test
    void basicMessage_emitsRequiredFields() {
        var msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Twoje buty są gotowe.", List.of(), "idem-sms-1");

        Map<String, Object> payload = SmsApiPayloadMapper.toPayload(msg, FROM);

        assertThat(payload)
                .containsEntry("to", "+48600100200")
                .containsEntry("message", "Twoje buty są gotowe.")
                .containsEntry("from", FROM)
                .containsEntry("idx", "idem-sms-1");
    }

    // ── Case 2: null idempotency key — idx field omitted ─────────────────
    @Test
    void nullIdempotencyKey_fieldOmitted() {
        var msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                "Wiadomość testowa.", List.of(), null);

        Map<String, Object> payload = SmsApiPayloadMapper.toPayload(msg, FROM);

        assertThat(payload).doesNotContainKey("idx");
    }

    // ── Case 3: long message (>160 chars) — full body emitted, no truncation ──
    @Test
    void longMessage_emittedFullyNoTruncation() {
        String longBody = "A".repeat(200);
        var msg = new OutboundMessage(
                Channel.SMS, "+48600100200", null,
                longBody, List.of(), "idem-long-1");

        Map<String, Object> payload = SmsApiPayloadMapper.toPayload(msg, FROM);

        assertThat(payload).containsEntry("message", longBody);
        assertThat(((String) payload.get("message"))).hasSize(200);
    }

    // ── Case 4: custom from — emitted as provided, no validation in mapper ──
    @Test
    void customFrom_emittedAsProvided() {
        var msg = new OutboundMessage(
                Channel.SMS, "+44123456789", null,
                "Your shoes are ready.", List.of(), null);

        Map<String, Object> payload = SmsApiPayloadMapper.toPayload(msg, "ACMESHOP");

        assertThat(payload).containsEntry("from", "ACMESHOP");
    }
}
