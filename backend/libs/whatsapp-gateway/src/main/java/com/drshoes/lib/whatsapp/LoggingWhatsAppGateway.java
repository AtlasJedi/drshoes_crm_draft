package com.drshoes.lib.whatsapp;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.messaging.RecipientHashUtil;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
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
