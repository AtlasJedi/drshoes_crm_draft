package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.dto.SmsApiInboundPayload;
import com.drshoes.app.messaging.service.InboundMessageService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Set;
import java.util.UUID;

/**
 * Receives SMSAPI MO (mobile-originated / inbound) callbacks.
 *
 * <h2>Authentication</h2>
 * Source IP allowlist via the {@code Cf-Connecting-Ip} header set by Cloudflare.
 * The header is NOT configurable — production traffic always arrives through Cloudflare.
 * Absent or non-allowlisted IP receives 403 with zero DB writes (fail-closed).
 *
 * <h2>Method + payload</h2>
 * POST /api/webhooks/smsapi/inbound, application/x-www-form-urlencoded.
 * Response: 200 JSON {@code {"messageId", "threadId", "duplicate"}}.
 *
 * <h2>Idempotency</h2>
 * Delegated to {@link InboundMessageService#recordSmsInbound} which checks
 * {@code provider_message_id} uniqueness. Replays return {@code duplicate=true}.
 * Race-window safety net: {@link DataAccessException} from UNIQUE partial index
 * violation caught here; returned as 200 + duplicate=true.
 *
 * <h2>Security</h2>
 * SecurityConfig lists /api/webhooks/** in PUBLIC_MATCHERS and CSRF_IGNORED.
 * Allowlist property: {@code messaging.sms.smsapi.allowlist} (distinct from
 * the delivery callback {@code callback-allowlist} so they can diverge in prod).
 *
 * <h2>Logging</h2>
 * INFO with key=value fields per CLAUDE.md §7. Sender phone is NOT logged at INFO (PII).
 */
@RestController
@RequestMapping("/api/webhooks/smsapi/inbound")
public class SmsApiInboundController {

    private static final Logger log = LoggerFactory.getLogger(SmsApiInboundController.class);

    private final InboundMessageService inboundService;
    private final Set<String>           allowlist;

    public SmsApiInboundController(
            InboundMessageService inboundService,
            @Value("${messaging.sms.smsapi.allowlist:198.18.0.1,198.18.0.2,198.18.0.3,198.18.0.4,198.18.0.5}")
            String allowlistCsv) {
        this.inboundService = inboundService;
        this.allowlist      = Set.of(allowlistCsv.split(","));
    }

    public record InboundResponse(UUID messageId, UUID threadId, boolean duplicate) {}

    @PostMapping(consumes = "application/x-www-form-urlencoded")
    public ResponseEntity<InboundResponse> receive(
            @RequestParam("sms_id")                           String smsId,
            @RequestParam("sms_from")                         String smsFrom,
            @RequestParam(value = "sms_to", required = false) String smsTo,
            @RequestParam("sms_text")                         String smsText,
            @RequestParam("sms_date")                         long   smsDate,
            HttpServletRequest req) {

        String ip = req.getHeader("Cf-Connecting-Ip");
        if (ip == null || !allowlist.contains(ip)) {
            log.warn("op=inbound.sms.received outcome=ip-rejected ip={}", ip);
            return ResponseEntity.status(403).build();
        }

        log.info("op=inbound.sms.received smsId={}", smsId);
        var payload = new SmsApiInboundPayload(smsId, smsFrom, smsTo, smsText, smsDate);
        try {
            var result = inboundService.recordSmsInbound(payload);
            log.info("op=inbound.sms.handled outcome=ok threadId={} duplicate={}",
                    result.threadId(), result.duplicate());
            return ResponseEntity.ok(
                new InboundResponse(result.messageId(), result.threadId(), result.duplicate()));
        } catch (DataAccessException ex) {
            log.info("op=inbound.sms.handled outcome=duplicate reason=race_constraint smsId={}", smsId);
            return ResponseEntity.ok(new InboundResponse(null, null, true));
        }
    }
}
