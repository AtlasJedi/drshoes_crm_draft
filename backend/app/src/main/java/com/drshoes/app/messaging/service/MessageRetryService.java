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

/**
 * Operator-initiated retry for messages with delivery_status='FAILED'.
 *
 * Creates a new message row via MessageRouter.sendManual (same pipeline, re-renders
 * template), then links it back to the original via retry_of_message_id and increments
 * retry_attempt. The original FAILED row is preserved as the historical record.
 *
 * LOC: ~60.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class MessageRetryService {

    private final MessageRepository messages;
    private final MessageRouter      router;
    private final OrderRepository    orders;

    /**
     * Retries a failed message. @Audited writes an audit row with parent_entity_id=orderId
     * (resolved from #result.orderId()) so the MessageSentTimelineHandler curator picks it
     * up as a MESSAGE_SENT event for the new row.
     *
     * @param failedMessageId id of the original FAILED message
     * @param actor           authenticated admin principal
     * @return MessageDto for the newly created retry row
     */
    @Transactional
    @Audited(parent = "#result.orderId")
    public MessageDto retry(UUID failedMessageId, AdminPrincipal actor) {
        // 1. Load original message
        MessageEntity orig = messages.findById(failedMessageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Message not found: " + failedMessageId));

        // 2. Ownership guard — validate the parent order exists (cross-tenant check)
        orders.findById(orig.getOrderId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Order not found: " + orig.getOrderId()));

        // 3. Validate FAILED status — only FAILED messages are retryable
        if (!DeliveryStatus.FAILED.name().equals(orig.getDeliveryStatus())) {
            log.warn("op=message.retry outcome=notRetryable actor={} messageId={} status={}",
                actor.userId(), failedMessageId, orig.getDeliveryStatus());
            throw new NotRetryableException(failedMessageId, orig.getDeliveryStatus());
        }

        // 4. Compute retry_attempt (V010 column defaults to 1 on original rows)
        int nextAttempt = (orig.getRetryAttempt() == null ? 1 : orig.getRetryAttempt()) + 1;

        log.info("op=message.retry outcome=start actor={} originalId={} orderId={} attempt={}",
            actor.userId(), failedMessageId, orig.getOrderId(), nextAttempt);

        // 5. Send via retry pipeline — uses stored body/subject directly, bypasses template
        //    re-render. sendManual would throw if templateId is null (e.g. messages seeded
        //    directly without a template). sendRetry is the correct path per plan errata.
        UUID newMsgId = router.sendRetry(orig, actor.userId());

        // 6. Link new row back to original and set retry_attempt
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
