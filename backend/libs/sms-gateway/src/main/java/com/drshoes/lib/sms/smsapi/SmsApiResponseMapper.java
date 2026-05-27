package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

/**
 * Pure mapping utility: SMSAPI HTTP response → DeliveryReceipt.
 *
 * Response shapes:
 *  - 200 + {"list":[{"id":"...","status":"QUEUE",...}],"count":1}
 *      → DeliveryReceipt.accepted(list[0].id)
 *  - 200 + {"error":N,"message":"..."}
 *      → DeliveryReceipt.failed("SMSAPI-N", message)
 *  - non-200
 *      → DeliveryReceipt.failed("HTTP-N", body)
 *
 * TODO(plan-errata #6): response shape verified against https://www.smsapi.pl/docs 2026-05-09.
 *   list[0].id is the stable SMSAPI message identifier. Error envelope fields "error" (int)
 *   and "message" (string) confirmed. Shape matches plan.
 */
@Slf4j
public final class SmsApiResponseMapper {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private SmsApiResponseMapper() {}

    /**
     * @param httpStatus HTTP response status code
     * @param body       raw response body string
     * @return {@link DeliveryReceipt} — never null
     */
    @SuppressWarnings("unchecked")
    public static DeliveryReceipt fromResponse(int httpStatus, String body) {
        if (httpStatus != 200) {
            return DeliveryReceipt.failed("HTTP-" + httpStatus, body);
        }

        try {
            Map<String, Object> json = MAPPER.readValue(body, MAP_TYPE);

            // Error envelope: {"error": N, "message": "..."}
            if (json.containsKey("error")) {
                int errorCode = ((Number) json.get("error")).intValue();
                String message = (String) json.getOrDefault("message", "SMSAPI error");
                return DeliveryReceipt.failed("SMSAPI-" + errorCode, message);
            }

            // Success envelope: {"list":[{"id":"...","status":"QUEUE",...}],"count":1}
            if (json.containsKey("list")) {
                List<Map<String, Object>> list = (List<Map<String, Object>>) json.get("list");
                if (list != null && !list.isEmpty()) {
                    String msgId = (String) list.get(0).get("id");
                    return DeliveryReceipt.accepted(msgId);
                }
            }

            // Unexpected shape
            log.warn("op=smsapi.parseResponse outcome=unknownShape body_preview={}",
                    body.length() > 200 ? body.substring(0, 200) : body);
            return DeliveryReceipt.failed("PARSE_ERROR", "Unexpected SMSAPI response shape");

        } catch (Exception e) {
            log.warn("op=smsapi.parseResponse outcome=parseError body_preview={}",
                    body.length() > 200 ? body.substring(0, 200) : body, e);
            return DeliveryReceipt.failed("PARSE_ERROR", e.getMessage());
        }
    }
}
