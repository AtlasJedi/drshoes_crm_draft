package com.drshoes.lib.whatsapp;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.messaging.RecipientHashUtil;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/**
 * No-op WhatsApp gateway that logs the dispatch and returns a synthetic receipt.
 * Used in local/demo environments where the real WhatsApp Cloud API is not configured.
 *
 * Log format: op=gateway.dispatch.whatsapp outcome=mocked recipient_hash=<8hex> body_len=<n> provider_id=<id>
 * The recipient is never logged raw — SHA-256 first-8-hex prefix only.
 */
@Slf4j
public class LoggingWhatsAppGateway implements WhatsAppGateway {

    @Override
    public Channel channel() { return Channel.WHATSAPP; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        var providerId = "log-wa-" + UUID.randomUUID();
        log.info("op=gateway.dispatch.whatsapp outcome=mocked recipient_hash={} body_len={} provider_id={}",
                RecipientHashUtil.hashFirst8Hex(m.recipient()), m.body().length(), providerId);
        return DeliveryReceipt.accepted(providerId);
    }
}
