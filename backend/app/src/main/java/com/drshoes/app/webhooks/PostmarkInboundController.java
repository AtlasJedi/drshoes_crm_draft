package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.dto.PostmarkInboundPayload;
import com.drshoes.app.messaging.service.InboundMessageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/**
 * Receives Postmark inbound stream callbacks.
 *
 * <h2>Authentication</h2>
 * HTTP Basic auth verified via constant-time compare ({@link MessageDigest#isEqual}).
 * Same {@code @Value} credential properties as the M4 outbound webhook controller —
 * no new secrets required. Mismatch → 401, zero DB writes.
 *
 * <h2>Endpoint</h2>
 * POST /api/webhooks/postmark/inbound — CSRF-exempt, no session auth required.
 * SecurityConfig lists /api/webhooks/** in PUBLIC_MATCHERS and CSRF_IGNORED.
 *
 * <h2>Idempotency</h2>
 * Primary path: service checks {@code provider_message_id} before inserting.
 * Race-window safety net: {@link DataAccessException} from UNIQUE partial index
 * violation is caught here and returned as 200 + duplicate=true.
 *
 * <h2>Body fallback</h2>
 * {@code StrippedTextReply} is used when non-blank; {@code TextBody} is the fallback.
 * This logic lives in {@link InboundMessageService}, not here.
 *
 * <h2>Logging</h2>
 * INFO per CLAUDE.md §7 key=value convention.
 * From/FromName NOT logged at INFO (PII risk).
 */
@RestController
@Slf4j
public class PostmarkInboundController {

    private final InboundMessageService inboundService;
    private final byte[] expectedUsername;
    private final byte[] expectedPassword;

    public PostmarkInboundController(
            InboundMessageService inboundService,
            @Value("${messaging.email.postmark.webhook-username:drshoes}") String webhookUsername,
            @Value("${messaging.email.postmark.webhook-secret:}") String webhookSecret) {
        this.inboundService   = inboundService;
        this.expectedUsername = webhookUsername.getBytes(StandardCharsets.UTF_8);
        this.expectedPassword = webhookSecret.getBytes(StandardCharsets.UTF_8);
    }

    public record InboundResponse(UUID messageId, UUID threadId, boolean duplicate) {}

    @PostMapping("/api/webhooks/postmark/inbound")
    public ResponseEntity<InboundResponse> receive(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody PostmarkInboundPayload payload) {

        if (!verifyBasicAuth(authHeader)) {
            log.info("op=webhook.postmark.inbound actor=postmark outcome=rejected");
            return ResponseEntity.status(401).build();
        }

        log.info("op=webhook.postmark.inbound actor=postmark messageId={} outcome=accepted",
            payload.messageId());

        try {
            var result = inboundService.recordEmailInbound(payload);
            log.info("op=webhook.postmark.inbound actor=postmark messageId={} threadId={} duplicate={} outcome={}",
                result.messageId(), result.threadId(), result.duplicate(),
                result.duplicate() ? "duplicate" : "accepted");
            return ResponseEntity.ok(
                new InboundResponse(result.messageId(), result.threadId(), result.duplicate()));
        } catch (DataAccessException ex) {
            // Race-window safety: two near-simultaneous identical webhooks may both pass
            // the findByProviderMessageId check before either writes; second insert hits
            // the UNIQUE partial index on (provider_message_id, channel). Treat as duplicate.
            log.info("op=webhook.postmark.inbound actor=postmark messageId={} outcome=duplicate reason=race_constraint",
                payload.messageId());
            return ResponseEntity.ok(new InboundResponse(null, null, true));
        }
    }

    /**
     * Parses "Basic &lt;base64&gt;" header, decodes to "username:password",
     * and performs constant-time credential comparison via {@link MessageDigest#isEqual}.
     * Both username and password comparisons always execute to prevent timing oracles.
     */
    private boolean verifyBasicAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) return false;
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(authHeader.substring(6).trim());
        } catch (IllegalArgumentException e) {
            return false;
        }
        int colonIdx = -1;
        for (int i = 0; i < decoded.length; i++) {
            if (decoded[i] == ':') { colonIdx = i; break; }
        }
        if (colonIdx < 0) return false;
        byte[] incomingUser = Arrays.copyOfRange(decoded, 0, colonIdx);
        byte[] incomingPass = Arrays.copyOfRange(decoded, colonIdx + 1, decoded.length);
        boolean userOk = MessageDigest.isEqual(incomingUser, expectedUsername);
        boolean passOk = MessageDigest.isEqual(incomingPass, expectedPassword);
        return userOk && passOk;
    }
}
