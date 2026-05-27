package com.drshoes.app.webhooks;

import com.drshoes.app.messaging.service.WebhookStatusReconciler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import lombok.extern.slf4j.Slf4j;

/**
 * Receives Postmark delivery webhook callbacks.
 *
 * <h2>Authentication</h2>
 * HTTP Basic auth. Credentials verified via constant-time compare
 * ({@link MessageDigest#isEqual}) to prevent timing-based credential oracle.
 * Mismatch → 401, zero DB writes.
 *
 * <h2>Body strategy</h2>
 * Spring binds a raw {@code String} body; this class deserializes to
 * {@link PostmarkWebhookPayload} manually via ObjectMapper.
 * This ensures the original raw JSON is archived in webhook_event.raw_payload
 * regardless of deserialization outcome.
 *
 * <h2>Endpoint</h2>
 * POST /api/webhooks/postmark — CSRF-exempt, no session auth required
 * (SecurityConfig lists /api/webhooks/** in both PUBLIC_MATCHERS and CSRF_IGNORED).
 *
 * <h2>Logging</h2>
 * Logs at INFO per CLAUDE.md §7 with key=value fields.
 * Raw payload is NOT logged at INFO (PII risk — recipient emails may appear).
 */
@RestController
@Slf4j
public class PostmarkWebhookController {

    private final WebhookStatusReconciler reconciler;
    private final WebhookEventMapper      mapper;
    private final ObjectMapper            objectMapper;

    private final byte[] expectedUsername;
    private final byte[] expectedPassword;

    public PostmarkWebhookController(
            WebhookStatusReconciler reconciler,
            WebhookEventMapper mapper,
            ObjectMapper objectMapper,
            @Value("${messaging.email.postmark.webhook-username:drshoes}") String webhookUsername,
            @Value("${messaging.email.postmark.webhook-secret:}") String webhookSecret) {
        this.reconciler       = reconciler;
        this.mapper           = mapper;
        this.objectMapper     = objectMapper;
        this.expectedUsername = webhookUsername.getBytes(StandardCharsets.UTF_8);
        this.expectedPassword = webhookSecret.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/api/webhooks/postmark")
    public ResponseEntity<Void> receive(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody String rawBody) {

        // ── 1. Authenticate ──────────────────────────────────────────────────
        if (!verifyBasicAuth(authHeader)) {
            log.info("op=webhook.postmark.received provider=postmark outcome=rejected_auth");
            return ResponseEntity.status(401).build();
        }

        // ── 2. Deserialize ───────────────────────────────────────────────────
        PostmarkWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, PostmarkWebhookPayload.class);
        } catch (Exception e) {
            log.warn("op=webhook.postmark.received provider=postmark outcome=rejected_payload error={}",
                    e.getMessage());
            return ResponseEntity.badRequest().build();
        }

        log.info("op=webhook.postmark.received provider=postmark recordType={} messageId={} outcome=accepted",
                payload.recordType(), payload.messageId());

        // ── 3. Map + reconcile ───────────────────────────────────────────────
        var event = mapper.fromPostmark(payload, rawBody);
        var result = reconciler.apply(event);

        log.info("op=webhook.postmark.reconciled provider=postmark recordType={} messageId={} reconcileOutcome={}",
                payload.recordType(), payload.messageId(), result.outcome());

        return ResponseEntity.ok().build();
    }

    // ── private ──────────────────────────────────────────────────────────────

    /**
     * Parses "Basic &lt;base64&gt;" header, decodes to "username:password",
     * and performs constant-time credential comparison via {@link MessageDigest#isEqual}.
     * Both username and password comparisons always execute to prevent timing oracles.
     */
    private boolean verifyBasicAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) {
            return false;
        }
        String encoded = authHeader.substring(6).trim();
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException e) {
            return false;
        }
        // Split on first ':' only — passwords may legitimately contain ':'
        int colonIdx = -1;
        for (int i = 0; i < decoded.length; i++) {
            if (decoded[i] == ':') { colonIdx = i; break; }
        }
        if (colonIdx < 0) return false;

        byte[] incomingUser = Arrays.copyOfRange(decoded, 0, colonIdx);
        byte[] incomingPass = Arrays.copyOfRange(decoded, colonIdx + 1, decoded.length);

        // Both comparisons run unconditionally (no short-circuit) to prevent timing oracle.
        boolean userOk = MessageDigest.isEqual(incomingUser, expectedUsername);
        boolean passOk = MessageDigest.isEqual(incomingPass, expectedPassword);
        return userOk && passOk;
    }
}
