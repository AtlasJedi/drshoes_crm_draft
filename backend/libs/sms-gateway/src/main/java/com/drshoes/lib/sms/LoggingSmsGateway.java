package com.drshoes.lib.sms;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.UUID;

public class LoggingSmsGateway implements SmsGateway {
    private static final Logger log = LoggerFactory.getLogger(LoggingSmsGateway.class);

    @Override public Channel channel() { return Channel.SMS; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        var id = "logging-" + UUID.randomUUID();
        log.info("[sms/noop] to={} bodyLen={} idem={} provider_id={}",
                m.recipient(), m.body().length(), m.idempotencyKey(), id);
        return DeliveryReceipt.accepted(id);
    }
}
