package com.drshoes.lib.email;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class LoggingEmailGatewayTest {

    @Test
    void channel_is_email() {
        assertThat(new LoggingEmailGateway().channel()).isEqualTo(Channel.EMAIL);
    }

    @Test
    void send_returns_accepted_receipt_with_provider_id() {
        var m = new OutboundMessage(Channel.EMAIL, "x@y.pl", "subj", "body", List.of(), "k1");
        var r = new LoggingEmailGateway().send(m);
        assertThat(r.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(r.providerMessageId()).startsWith("logging-");
    }
}
