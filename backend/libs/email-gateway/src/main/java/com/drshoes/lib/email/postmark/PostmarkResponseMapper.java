package com.drshoes.lib.email.postmark;

import com.drshoes.lib.messaging.DeliveryReceipt;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
@Slf4j
public class PostmarkResponseMapper {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private PostmarkResponseMapper() {}
    public static DeliveryReceipt fromResponse(int httpStatus, String body) {
        if (httpStatus != 200) {
            return DeliveryReceipt.failed("HTTP-" + httpStatus, body);
        }

        try {
            Map<String, Object> json = MAPPER.readValue(body, MAP_TYPE);
            int errorCode = ((Number) json.getOrDefault("ErrorCode", 0)).intValue();
            if (errorCode == 0) {
                String messageId = (String) json.get("MessageID");
                return DeliveryReceipt.accepted(messageId);
            } else {
                String message = (String) json.getOrDefault("Message", "Postmark inline error");
                return DeliveryReceipt.failed("POSTMARK-" + errorCode, message);
            }
        } catch (Exception e) {
            log.warn("op=postmark.parseResponse outcome=parseError body_preview={}",
                    body.length() > 200 ? body.substring(0, 200) : body, e);
            return DeliveryReceipt.failed("PARSE_ERROR", e.getMessage());
        }
    }
}
