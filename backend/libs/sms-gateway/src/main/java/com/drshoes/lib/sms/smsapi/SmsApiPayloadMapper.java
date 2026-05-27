package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.OutboundMessage;

import java.util.LinkedHashMap;
import java.util.Map;
public class SmsApiPayloadMapper {

    private SmsApiPayloadMapper() {}
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
