package com.drshoes.lib.messaging;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OutboundMessageTest {

    @Test
    void rejects_blank_recipient() {
        assertThatThrownBy(() -> new OutboundMessage(
                Channel.SMS, "  ", null, "hi", List.of(), "idem-1", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("recipient");
    }

    @Test
    void rejects_blank_body() {
        assertThatThrownBy(() -> new OutboundMessage(
                Channel.EMAIL, "x@y.pl", "subj", "", List.of(), "idem-1", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("body");
    }

    @Test
    void allows_null_subject_for_sms() {
        var m = OutboundMessage.of(Channel.SMS, "+48500000000", null, "hi", List.of(), "k");
        assertThat(m.subject()).isNull();
        assertThat(m.channel()).isEqualTo(Channel.SMS);
    }

    @Test
    void requires_subject_for_email() {
        assertThatThrownBy(() -> new OutboundMessage(
                Channel.EMAIL, "x@y.pl", null, "hi", List.of(), "idem-1", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("subject");
    }

    @Test
    void attachments_default_immutable() {
        var m = OutboundMessage.of(Channel.EMAIL, "x@y.pl", "s", "b", List.of(), "k");
        assertThatThrownBy(() -> m.attachments().add(new Attachment("k", "image/png", 1L)))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void of_factory_sets_bodyHtml_null() {
        var m = OutboundMessage.of(Channel.EMAIL, "x@y.pl", "s", "b", List.of(), "k");
        assertThat(m.bodyHtml()).isNull();
    }

    @Test
    void full_ctor_accepts_bodyHtml() {
        var m = new OutboundMessage(Channel.EMAIL, "x@y.pl", "s", "b", List.of(), "k", "<p>hi</p>");
        assertThat(m.bodyHtml()).isEqualTo("<p>hi</p>");
    }
}
