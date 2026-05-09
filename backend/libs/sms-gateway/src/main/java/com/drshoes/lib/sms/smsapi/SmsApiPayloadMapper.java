package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.OutboundMessage;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pure mapping utility: OutboundMessage → SMSAPI /sms.do JSON payload.
 *
 * Payload fields: to, message, from, idx (omitted if null).
 *
 * TODO(plan-errata #6): plan specified "idempotency_key" but SMSAPI docs use "idx"
 *   (with optional check_idx=1 for duplicate-send protection within 24 h).
 *   Verified against https://www.smsapi.pl/docs 2026-05-09. Field renamed to "idx".
 *   The check_idx flag is the responsibility of task 4-6 (SmsApiSmsGateway).
 */
public final class SmsApiPayloadMapper {

    private SmsApiPayloadMapper() {}

    /**
     * @param msg  the outbound SMS message
     * @param from sender name or phone number registered in SMSAPI account
     * @return Jackson-serialisable map representing the SMSAPI /sms.do request body
     */
    public static Map<String, Object> toPayload(OutboundMessage msg, String from) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", msg.recipient());
        payload.put("message", msg.body());
        payload.put("from", from);
        if (msg.idempotencyKey() != null && !msg.idempotencyKey().isBlank()) {
            payload.put("idx", msg.idempotencyKey());
        }
        return payload;
    }
}
