package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.DeliveryStatus;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.order.domain.OrderRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class MessageRetryService {

    private final MessageRepository messages;
    private final MessageRouter      router;
    private final OrderRepository    orders;
    @Transactional
    @Audited(parent = "#result.orderId")
    public MessageDto retry(UUID failedMessageId, AdminPrincipal actor) {
        MessageEntity orig = messages.findById(failedMessageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Message not found: " + failedMessageId));
        orders.findById(orig.getOrderId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Order not found: " + orig.getOrderId()));
        if (!DeliveryStatus.FAILED.name().equals(orig.getDeliveryStatus())) {
            log.warn("op=message.retry outcome=notRetryable actor={} messageId={} status={}",
                actor.userId(), failedMessageId, orig.getDeliveryStatus());
            throw new NotRetryableException(failedMessageId, orig.getDeliveryStatus());
        }
        int nextAttempt = (orig.getRetryAttempt() == null ? 1 : orig.getRetryAttempt()) + 1;

        log.info("op=message.retry outcome=start actor={} originalId={} orderId={} attempt={}",
            actor.userId(), failedMessageId, orig.getOrderId(), nextAttempt);
        UUID newMsgId = router.sendRetry(orig, actor.userId());
        MessageEntity newMsg = messages.findById(newMsgId)
            .orElseThrow(() -> new IllegalStateException(
                "Retry message not found after send: " + newMsgId));
        newMsg.setRetryOfMessageId(failedMessageId);
        newMsg.setRetryAttempt(nextAttempt);
        messages.save(newMsg);

        log.info("op=message.retry outcome=ok actor={} originalId={} newId={} attempt={} status={}",
            actor.userId(), failedMessageId, newMsgId, nextAttempt, newMsg.getDeliveryStatus());

        return toDto(newMsg);
    }

    private MessageDto toDto(MessageEntity e) {
        return new MessageDto(
            e.getId(), e.getOrderId(), e.getClientId(),
            e.getDirection(), e.getChannel(),
            e.getTemplateId(), e.getTriggerId(),
            e.getSubject(), e.getBody(),
            e.getDeliveryStatus(), e.getProviderMessageId(),
            e.getSentAt(), e.getCreatedAt(),
            e.getErrorCode(), e.getErrorMessage(),
            e.getRetryOfMessageId(),
            e.getRetryAttempt() == null ? 1 : e.getRetryAttempt(),
            e.getThreadId());
    }
}
