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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageGatewayDispatcherTest {

    @Mock EmailGateway emailGateway;
    @Mock SmsGateway smsGateway;
    @Mock MessageRepository messages;
    @Mock MessageThreadRepository threads;

    private MessageGatewayDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new MessageGatewayDispatcher(emailGateway, smsGateway, messages, threads);
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
    @DisplayName("dispatch unknown channel throws IllegalArgumentException")
    void dispatch_unknownChannel_throwsIllegalArgument() {
        var msg = buildMessage("WHATSAPP");
        msg.setThreadId(UUID.randomUUID());

        // OutboundMessage rejects blank subject for EMAIL only; WHATSAPP is not EMAIL.
        // But WHATSAPP is not handled in the switch — expect IllegalArgumentException from
        // the switch default arm, not from OutboundMessage validation.
        // Note: OutboundMessage requires non-blank recipient AND body.
        assertThatThrownBy(() -> dispatcher.dispatch(msg, "+48500000001", null, "Hello"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown channel");
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
}
