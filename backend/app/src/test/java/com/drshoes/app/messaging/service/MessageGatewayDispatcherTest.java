package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.sms.SmsGateway;
import com.drshoes.lib.whatsapp.WhatsAppGateway;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.sdk.testing.junit5.OpenTelemetryExtension;
import io.opentelemetry.sdk.trace.data.SpanData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageGatewayDispatcherTest {

    @RegisterExtension
    static final OpenTelemetryExtension otelTesting = OpenTelemetryExtension.create();

    @Mock EmailGateway emailGateway;
    @Mock SmsGateway smsGateway;
    @Mock WhatsAppGateway whatsAppGateway;
    @Mock MessageRepository messages;
    @Mock MessageThreadRepository threads;

    private MessageGatewayDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new MessageGatewayDispatcher(
                emailGateway, smsGateway, whatsAppGateway,
                otelTesting.getOpenTelemetry(),
                messages, threads);
    }

    private MessageEntity buildMessage(String channel) {
        var msg = MessageEntity.newMessage();
        msg.setChannel(channel);
        msg.setDirection("OUTBOUND");
        msg.setBody("Test body");
        lenient().when(messages.save(any())).thenAnswer(inv -> inv.getArgument(0));
        return msg;
    }

    @Test
    @DisplayName("dispatch EMAIL happy path: marks SENT, sets providerMessageId, bumps thread")
    void dispatch_emailHappyPath_marksSent() {
        var msg = buildMessage("EMAIL");
        UUID threadId = UUID.randomUUID();
        msg.setThreadId(threadId);

        var thread = new MessageThreadEntity();
        when(threads.findById(threadId)).thenReturn(Optional.of(thread));
        when(emailGateway.send(any(OutboundMessage.class)))
                .thenReturn(DeliveryReceipt.accepted("pm-abc-123"));

        var result = dispatcher.dispatch(msg, "client@example.com", "Subject", "Test body");

        assertThat(result.getDeliveryStatus()).isEqualTo("SENT");
        assertThat(result.getProviderMessageId()).isEqualTo("pm-abc-123");
        assertThat(result.getSentAt()).isNotNull();
        verify(threads).save(thread);
    }

    @Test
    @DisplayName("dispatch SMS happy path: marks SENT, sets providerMessageId, bumps thread")
    void dispatch_smsHappyPath_marksSent() {
        var msg = buildMessage("SMS");
        UUID threadId = UUID.randomUUID();
        msg.setThreadId(threadId);

        var thread = new MessageThreadEntity();
        when(threads.findById(threadId)).thenReturn(Optional.of(thread));
        when(smsGateway.send(any(OutboundMessage.class)))
                .thenReturn(DeliveryReceipt.accepted("sms-provider-456"));

        var result = dispatcher.dispatch(msg, "+48500600700", null, "Treść SMS");

        assertThat(result.getDeliveryStatus()).isEqualTo("SENT");
        assertThat(result.getProviderMessageId()).isEqualTo("sms-provider-456");
        verify(threads).save(thread);
    }

    @Test
    @DisplayName("dispatch EMAIL gateway throws: marks FAILED, records error, does not bump thread")
    void dispatch_emailGatewayThrows_marksFailed() {
        var msg = buildMessage("EMAIL");
        msg.setThreadId(UUID.randomUUID());

        when(emailGateway.send(any(OutboundMessage.class)))
                .thenThrow(new RuntimeException("SMTP connection refused"));

        var result = dispatcher.dispatch(msg, "client@example.com", "Subject", "Test body");

        assertThat(result.getDeliveryStatus()).isEqualTo("FAILED");
        assertThat(result.getErrorCode()).isNotBlank();
        assertThat(result.getErrorMessage()).contains("SMTP connection refused");
        verify(threads, never()).save(any());
    }

    @Test
    @DisplayName("dispatch unknown channel string throws IllegalArgumentException")
    void dispatch_unknownChannelString_throwsIllegalArgument() {
        var msg = buildMessage("SMS"); // valid channel to pass buildMessage, overridden below
        msg.setChannel("PIGEON");      // force an unrecognised raw string
        msg.setThreadId(UUID.randomUUID());

        // Channel.valueOf("PIGEON") throws IllegalArgumentException before reaching the switch.
        assertThatThrownBy(() -> dispatcher.dispatch(msg, "+48500000001", null, "Hello"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("dispatch WHATSAPP happy path: marks SENT, sets providerMessageId, bumps thread")
    void dispatch_whatsappHappyPath_marksSent() {
        var msg = buildMessage("WHATSAPP");
        UUID threadId = UUID.randomUUID();
        msg.setThreadId(threadId);

        var thread = new MessageThreadEntity();
        when(threads.findById(threadId)).thenReturn(Optional.of(thread));
        when(whatsAppGateway.send(any(OutboundMessage.class)))
                .thenReturn(DeliveryReceipt.accepted("log-wa-test-provider-id"));

        var result = dispatcher.dispatch(msg, "+48500600700", null, "Cześć, twoje zamówienie jest gotowe.");

        assertThat(result.getDeliveryStatus()).isEqualTo("SENT");
        assertThat(result.getProviderMessageId()).isEqualTo("log-wa-test-provider-id");
        assertThat(result.getSentAt()).isNotNull();
        verify(threads).save(thread);
    }

    @Test
    @DisplayName("dispatch blank recipient throws IllegalArgumentException from OutboundMessage")
    void dispatch_blankRecipient_throwsIllegalArgument() {
        // OutboundMessage rejects blank recipient at construction — dispatcher propagates.
        var msg = buildMessage("SMS");
        msg.setThreadId(UUID.randomUUID());

        assertThatThrownBy(() -> dispatcher.dispatch(msg, "", null, "Hello"))
                .isInstanceOf(IllegalArgumentException.class);

        // Gateway must not have been called.
        verifyNoInteractions(smsGateway);
    }

    // ── OTel span-emission tests ──────────────────────────────────────────────

    @Test
    @DisplayName("dispatch EMAIL emits one messaging.dispatch span with channel, message_id, recipient_hash")
    void dispatch_emitsSpan_withChannelAttribute() {
        var msg = buildMessage("EMAIL");
        msg.setThreadId(UUID.randomUUID());
        when(threads.findById(any())).thenReturn(Optional.of(new MessageThreadEntity()));
        when(emailGateway.send(any())).thenReturn(DeliveryReceipt.accepted("pm-span-test"));

        dispatcher.dispatch(msg, "client@example.com", "Subject", "Body");

        List<SpanData> spans = otelTesting.getSpans();
        assertThat(spans).hasSize(1);
        SpanData span = spans.get(0);
        assertThat(span.getName()).isEqualTo("messaging.dispatch");
        assertThat(span.getAttributes().get(AttributeKey.stringKey("messaging.channel")))
                .isEqualTo("EMAIL");
        assertThat(span.getAttributes().get(AttributeKey.stringKey("messaging.message_id")))
                .isNotNull();
        assertThat(span.getAttributes().get(AttributeKey.stringKey("messaging.recipient_hash")))
                .hasSize(8);
        assertThat(span.getStatus().getStatusCode()).isEqualTo(StatusCode.OK);
    }

    @Test
    @DisplayName("dispatch gateway failure sets span status ERROR (soft-fail: exception swallowed, delivery FAILED)")
    void dispatch_softFailMarksSpanError() {
        var msg = buildMessage("EMAIL");
        msg.setThreadId(UUID.randomUUID());
        when(emailGateway.send(any())).thenThrow(new RuntimeException("SMTP timeout"));

        // Dispatcher catches the gateway exception internally (marks FAILED, does not rethrow).
        // The dispatcher inspects persisted.getDeliveryStatus() and explicitly sets ERROR on
        // Span.current() before returning — so Jaeger can filter failed dispatches by span status.
        var result = dispatcher.dispatch(msg, "client@example.com", "Subject", "Body");

        assertThat(result.getDeliveryStatus()).isEqualTo("FAILED");

        List<SpanData> spans = otelTesting.getSpans();
        assertThat(spans).hasSize(1);
        SpanData span = spans.get(0);
        assertThat(span.getName()).isEqualTo("messaging.dispatch");
        assertThat(span.getStatus().getStatusCode()).isEqualTo(StatusCode.ERROR);
    }
}
