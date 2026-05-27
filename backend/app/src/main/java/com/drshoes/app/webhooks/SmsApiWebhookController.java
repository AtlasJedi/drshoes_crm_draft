package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.service.WebhookStatusReconciler;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
@RestController
@Slf4j
public class SmsApiWebhookController {

    private final WebhookStatusReconciler reconciler;
    private final WebhookEventMapper      mapper;
    private final ObjectMapper            objectMapper;
    private final List<String>            allowlist;
    private final String                  clientIpHeader;

    public SmsApiWebhookController(
            WebhookStatusReconciler reconciler,
            WebhookEventMapper mapper,
            ObjectMapper objectMapper,
            @Value("${messaging.sms.smsapi.callback-allowlist:89.174.81.98,91.185.187.219,213.189.53.211,31.186.83.18,212.91.26.253}")
            List<String> allowlist,
            @Value("${messaging.sms.smsapi.client-ip-header:X-Forwarded-For}")
            String clientIpHeader) {
        this.reconciler     = reconciler;
        this.mapper         = mapper;
        this.objectMapper   = objectMapper;
        this.allowlist      = allowlist;
        this.clientIpHeader = clientIpHeader;
    }

    @GetMapping(value = "/api/webhooks/smsapi", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> receive(
            @RequestParam("MsgId")                              String  msgId,
            @RequestParam("status")                            Integer statusCode,
            @RequestParam("donedate")                          Long    doneDateUnixSeconds,
            @RequestParam(value = "status_name", required = false) String  statusName,
            @RequestParam(value = "idx",         required = false) String  idx,
            HttpServletRequest request) {
        String clientIp = resolveClientIp(request);
        if (!allowlist.contains(clientIp)) {
            log.info("op=webhook.smsapi.received provider=smsapi clientIp={} outcome=rejected_ip",
                    clientIp);
            return ResponseEntity.status(403)
                .contentType(MediaType.TEXT_PLAIN)
                .body("Forbidden");
        }

        log.info("op=webhook.smsapi.received provider=smsapi msgId={} statusName={} statusCode={} outcome=accepted",
                msgId, statusName, statusCode);
        String rawQueryJson = buildRawQueryJson(msgId, statusCode, doneDateUnixSeconds, statusName, idx);
        Instant occurredAt = Instant.ofEpochSecond(doneDateUnixSeconds);
        var event  = mapper.fromSmsApi(msgId, statusName, statusCode, occurredAt, rawQueryJson);
        var result = reconciler.apply(event);

        log.info("op=webhook.smsapi.reconciled provider=smsapi msgId={} reconcileOutcome={}",
                msgId, result.outcome());

        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_PLAIN)
            .body("OK");
    }

    private String resolveClientIp(HttpServletRequest request) {
        String fromHeader = request.getHeader(clientIpHeader);
        if (fromHeader != null && !fromHeader.isBlank()) {
            return fromHeader.split("\\s*,\\s*")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String buildRawQueryJson(String msgId, Integer statusCode, Long donedate,
                                     String statusName, String idx) {
        try {
            var params = new LinkedHashMap<String, Object>();
            params.put("MsgId",    msgId);
            params.put("status",   statusCode);
            params.put("donedate", donedate);
            if (statusName != null) params.put("status_name", statusName);
            if (idx        != null) params.put("idx",         idx);
            return objectMapper.writeValueAsString(params);
        } catch (Exception e) {
            log.warn("op=webhook.smsapi.received provider=smsapi outcome=rawJsonSerializeFailed error={}",
                    e.getMessage());
            return "{}";
        }
    }
}
