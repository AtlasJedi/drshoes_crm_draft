package com.drshoes.lib.sms;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class LoggingSmsGateway implements SmsGateway {

    @Override public Channel channel() { return Channel.SMS; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        var id = "logging-" + UUID.randomUUID();
        log.info("[sms/noop] to={} bodyLen={} idem={} provider_id={}",
                m.recipient(), m.body().length(), m.idempotencyKey(), id);
        return DeliveryReceipt.accepted(id);
    }
}
