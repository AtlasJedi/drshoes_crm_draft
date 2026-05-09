package com.drshoes.app.messaging.service;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageRetryServiceTest {

    @Mock MessageRepository messageRepository;
    @Mock MessageRouter      messageRouter;
    @Mock OrderRepository    orderRepository;

    @InjectMocks MessageRetryService retryService;

    private final UUID ACTOR_ID  = UUID.randomUUID();
    private final UUID ORDER_ID  = UUID.randomUUID();
    private final UUID CLIENT_ID = UUID.randomUUID();

    private AdminPrincipal actor() {
        return new AdminPrincipal(ACTOR_ID, "actor@drshoes.pl", "OWNER");
    }

    private Order stubOrder() {
        var o = new Order();
        // minimal fields needed for ownership check
        return o;
    }

    private MessageEntity failedMessage(UUID id, UUID orderId) {
        var m = MessageEntity.newMessage();
        // Use reflection to set id since there is no public setter
        try {
            var f = MessageEntity.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(m, id);
        } catch (Exception e) { throw new RuntimeException(e); }
        m.setOrderId(orderId);
        m.setClientId(CLIENT_ID);
        m.setDirection("OUTBOUND");
        m.setChannel("EMAIL");
        m.setSubject("Re: Zamówienie");
        m.setBody("Treść wiadomości");
        m.setDeliveryStatus(DeliveryStatus.FAILED.name());
        m.setSentBy(ACTOR_ID);
        m.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        return m;
    }

    // ---- helper: build a delivered (non-FAILED) message ----
    private MessageEntity deliveredMessage(UUID id, UUID orderId) {
        var m = failedMessage(id, orderId);
        m.setDeliveryStatus(DeliveryStatus.DELIVERED.name());
        return m;
    }

    @Test
    void retry_happyPath_returnsNewMessageDto() {
        var origId   = UUID.randomUUID();
        var newMsgId = UUID.randomUUID();
        var orig = failedMessage(origId, ORDER_ID);
        // retryAttempt defaults to 1 on entity; first retry → nextAttempt = 2

        when(messageRepository.findById(origId)).thenReturn(Optional.of(orig));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(stubOrder()));
        when(messageRouter.sendManual(eq(ORDER_ID), eq(CLIENT_ID), any(), anyString(), eq(ACTOR_ID)))
            .thenReturn(newMsgId);

        var newMsg = MessageEntity.newMessage();
        try {
            var f = MessageEntity.class.getDeclaredField("id"); f.setAccessible(true); f.set(newMsg, newMsgId);
        } catch (Exception e) { throw new RuntimeException(e); }
        newMsg.setOrderId(ORDER_ID);
        newMsg.setClientId(CLIENT_ID);
        newMsg.setDirection("OUTBOUND");
        newMsg.setChannel("EMAIL");
        newMsg.setDeliveryStatus(DeliveryStatus.SENT.name());
        newMsg.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        when(messageRepository.findById(newMsgId)).thenReturn(Optional.of(newMsg));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageDto dto = retryService.retry(origId, actor());

        assertThat(dto.id()).isEqualTo(newMsgId);
        assertThat(dto.deliveryStatus()).isEqualTo(DeliveryStatus.SENT.name());
        assertThat(dto.retryOfMessageId()).isEqualTo(origId);
        assertThat(dto.retryAttempt()).isEqualTo(2);
    }

    @Test
    void retry_notFailed_throws409() {
        var origId    = UUID.randomUUID();
        var delivered = deliveredMessage(origId, ORDER_ID);
        when(messageRepository.findById(origId)).thenReturn(Optional.of(delivered));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(stubOrder()));

        assertThatThrownBy(() -> retryService.retry(origId, actor()))
            .isInstanceOf(NotRetryableException.class);
    }

    @Test
    void retry_messageNotFound_throws404() {
        var id = UUID.randomUUID();
        when(messageRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> retryService.retry(id, actor()))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("404");
    }

    @Test
    void retry_retryOfRetry_chainContinues() {
        // original (attempt 1) → retry 1 (attempt 2) → now retrying to attempt 3
        var retry1Id = UUID.randomUUID();
        var retry2Id = UUID.randomUUID();

        var retry1Msg = failedMessage(retry1Id, ORDER_ID);
        // simulate retry_attempt=2 (stored on entity as column via V010)
        retry1Msg.setRetryAttempt(2);

        when(messageRepository.findById(retry1Id)).thenReturn(Optional.of(retry1Msg));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(stubOrder()));
        when(messageRouter.sendManual(eq(ORDER_ID), eq(CLIENT_ID), any(), anyString(), eq(ACTOR_ID)))
            .thenReturn(retry2Id);

        var retry2Msg = MessageEntity.newMessage();
        try {
            var f = MessageEntity.class.getDeclaredField("id"); f.setAccessible(true); f.set(retry2Msg, retry2Id);
        } catch (Exception e) { throw new RuntimeException(e); }
        retry2Msg.setOrderId(ORDER_ID);
        retry2Msg.setClientId(CLIENT_ID);
        retry2Msg.setDirection("OUTBOUND");
        retry2Msg.setChannel("EMAIL");
        retry2Msg.setDeliveryStatus(DeliveryStatus.SENT.name());
        retry2Msg.setSentAt(OffsetDateTime.now(ZoneOffset.UTC));
        when(messageRepository.findById(retry2Id)).thenReturn(Optional.of(retry2Msg));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageDto dto = retryService.retry(retry1Id, actor());

        assertThat(dto.retryAttempt()).isEqualTo(3);
        assertThat(dto.retryOfMessageId()).isEqualTo(retry1Id);
    }
}
