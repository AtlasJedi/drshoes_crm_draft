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

/**
 * Receives SMSAPI delivery callbacks.
 *
 * <h2>Authentication</h2>
 * Source IP allowlist. SMSAPI does NOT sign callbacks; identity verified by IP only.
 * Client IP is read from the configured header ({@code messaging.sms.smsapi.client-ip-header};
 * default {@code X-Forwarded-For}); the leftmost token is used for proxy compatibility.
 * Falls back to {@code request.getRemoteAddr()} when the header is absent.
 * Rejected IPs receive 403 "Forbidden" with zero DB writes.
 *
 * <h2>Method and response</h2>
 * GET /api/webhooks/smsapi (SMSAPI spec §3.6.1 — GET, not POST).
 * Response: 200 with body exactly {@code "OK"} (text/plain, case-sensitive — SMSAPI retries otherwise).
 *
 * <h2>Idempotency</h2>
 * SMSAPI has no per-event id; dedupe relies on the state-guarded UPDATE in
 * {@link WebhookStatusReconciler} (only SENT→target transition is allowed).
 *
 * <h2>Endpoint security</h2>
 * SecurityConfig already lists {@code /api/webhooks/**} in PUBLIC_MATCHERS and CSRF_IGNORED.
 * GET requests are never CSRF-protected by default; no additional config required.
 *
 * <h2>Logging</h2>
 * INFO with key=value fields per CLAUDE.md §7. Raw query params are NOT logged at INFO (PII risk).
 */
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

        // ── 1. IP allowlist check ────────────────────────────────────────────
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

        // ── 2. Build raw query-params JSON for archival ──────────────────────
        String rawQueryJson = buildRawQueryJson(msgId, statusCode, doneDateUnixSeconds, statusName, idx);

        // ── 3. Map + reconcile ───────────────────────────────────────────────
        Instant occurredAt = Instant.ofEpochSecond(doneDateUnixSeconds);
        var event  = mapper.fromSmsApi(msgId, statusName, statusCode, occurredAt, rawQueryJson);
        var result = reconciler.apply(event);

        log.info("op=webhook.smsapi.reconciled provider=smsapi msgId={} reconcileOutcome={}",
                msgId, result.outcome());

        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_PLAIN)
            .body("OK");
    }

    // ── private ──────────────────────────────────────────────────────────────

    private String resolveClientIp(HttpServletRequest request) {
        String fromHeader = request.getHeader(clientIpHeader);
        if (fromHeader != null && !fromHeader.isBlank()) {
            // X-Forwarded-For may be comma-separated; leftmost token = original client
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
