package com.drshoes.lib.email;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.UUID;

public class LoggingEmailGateway implements EmailGateway {
    private static final Logger log = LoggerFactory.getLogger(LoggingEmailGateway.class);

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
