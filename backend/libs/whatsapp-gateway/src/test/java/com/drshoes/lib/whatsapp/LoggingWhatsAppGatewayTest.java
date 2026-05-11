package com.drshoes.lib.whatsapp;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryStatus;
import com.drshoes.lib.messaging.OutboundMessage;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class LoggingWhatsAppGatewayTest {

    @Test
    void channel_is_whatsapp() {
        assertThat(new LoggingWhatsAppGateway().channel()).isEqualTo(Channel.WHATSAPP);
    }

    @Test
    void send_returns_accepted_receipt_with_log_wa_prefix() {
        var m = new OutboundMessage(Channel.WHATSAPP, "+48500000000", null, "hi", List.of(), "k");
        var r = new LoggingWhatsAppGateway().send(m);
        assertThat(r.initialStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(r.providerMessageId()).startsWith("log-wa-");
    }

    @Test
    void send_does_not_throw_for_minimal_message() {
        var m = new OutboundMessage(Channel.WHATSAPP, "+48123456789", null, "body", List.of(), null);
        assertThat(new LoggingWhatsAppGateway().send(m)).isNotNull();
    }
}
