package com.drshoes.lib.email;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class LoggingEmailGateway implements EmailGateway {

    @Override public Channel channel() { return Channel.EMAIL; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        var id = "logging-" + UUID.randomUUID();
        log.info("[email/noop] to={} subject={} bodyLen={} htmlLen={} attachments={} idem={} provider_id={}",
                m.recipient(), m.subject(), m.body().length(),
                m.bodyHtml() != null ? m.bodyHtml().length() : 0,
                m.attachments().size(), m.idempotencyKey(), id);
        return DeliveryReceipt.accepted(id);
    }
}
