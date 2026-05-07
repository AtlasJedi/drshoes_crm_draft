package com.drshoes.lib.sms;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class LoggingSmsGatewayTest {

    @Test
    void channel_is_sms() {
        assertThat(new LoggingSmsGateway().channel()).isEqualTo(Channel.SMS);
    }

    @Test
    void send_returns_accepted_receipt() {
        var m = new OutboundMessage(Channel.SMS, "+48500000000", null, "hi", List.of(), "k");
        var r = new LoggingSmsGateway().send(m);
        assertThat(r.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(r.providerMessageId()).startsWith("logging-");
    }
}
