package com.drshoes.app.webhooks;

import jakarta.validation.Valid;
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
            @Valid @RequestBody PostmarkInboundPayload payload) {

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
            log.info("op=webhook.postmark.inbound actor=postmark messageId={} outcome=duplicate reason=race_constraint",
                payload.messageId());
            return ResponseEntity.ok(new InboundResponse(null, null, true));
        }
    }
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
