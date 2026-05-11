package com.drshoes.lib.whatsapp;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

/**
 * No-op WhatsApp gateway that logs the dispatch and returns a synthetic receipt.
 * Used in local/demo environments where the real WhatsApp Cloud API is not configured.
 *
 * Log format: op=gateway.dispatch.whatsapp outcome=mocked recipient_hash=<8hex> body_len=<n> provider_id=<id>
 * The recipient is never logged raw — SHA-256 first-8-hex prefix only.
 */
public class LoggingWhatsAppGateway implements WhatsAppGateway {

    private static final Logger log = LoggerFactory.getLogger(LoggingWhatsAppGateway.class);

    @Override
    public Channel channel() { return Channel.WHATSAPP; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        var providerId = "log-wa-" + UUID.randomUUID();
        log.info("op=gateway.dispatch.whatsapp outcome=mocked recipient_hash={} body_len={} provider_id={}",
                recipientHash(m.recipient()), m.body().length(), providerId);
        return DeliveryReceipt.accepted(providerId);
    }

    private static String recipientHash(String recipient) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(recipient.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 8);
        } catch (NoSuchAlgorithmException e) {
            return "00000000"; // SHA-256 is always available on JVM
        }
    }
}
