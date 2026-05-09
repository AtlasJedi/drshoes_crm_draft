package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.SendMessageRequest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * REST: GET + POST /api/admin/orders/{orderId}/messages.
 * Actor resolved via {@code @AuthenticationPrincipal AdminPrincipal} — no per-request DB lookup.
 * {@code message.sent_by} and {@code audit_log.actor_id} both carry the authenticated user's UUID.
 */
@RestController
@RequestMapping("/api/admin/orders/{orderId}/messages")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class MessagesController {

    private static final Logger log = LoggerFactory.getLogger(MessagesController.class);
    private static final Set<String> VALID_CHANNELS = Set.of("EMAIL", "SMS");

    private final MessageRepository messageRepository;
    private final MessageRouter router;
    private final OrderRepository orderRepository;

    public MessagesController(MessageRepository messageRepository,
                               MessageRouter router,
                               OrderRepository orderRepository) {
        this.messageRepository = messageRepository;
        this.router = router;
        this.orderRepository = orderRepository;
    }

    @GetMapping
    public List<MessageDto> list(@PathVariable UUID orderId,
                                 @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=messages.list actor={} orderId={} outcome=ok", actor.email(), orderId);
        return messageRepository.findAllByOrderIdOrderByCreatedAtAsc(orderId)
            .stream()
            .map(this::toDto)
            .toList();
    }

    @PostMapping
    public ResponseEntity<MessageDto> send(@PathVariable UUID orderId,
                                           @RequestBody SendMessageRequest req,
                                           @AuthenticationPrincipal AdminPrincipal actor) {
        if (req.templateId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "templateId is required");
        }
        if (req.channel() == null || !VALID_CHANNELS.contains(req.channel().toUpperCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "channel must be EMAIL or SMS");
        }
        String channel = req.channel().toUpperCase();

        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        UUID messageId = router.sendManual(orderId, order.getClientId(), req.templateId(),
            channel, actor.userId());

        MessageEntity msg = messageRepository.findById(messageId)
            .orElseThrow(() -> new IllegalStateException("Message not found after send: " + messageId));

        log.info("op=messages.send actor={} actorId={} orderId={} templateId={} channel={} outcome=ok",
            actor.email(), actor.userId(), orderId, req.templateId(), channel);

        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(msg));
    }

    private MessageDto toDto(MessageEntity e) {
        return new MessageDto(
            e.getId(),
            e.getOrderId(),
            e.getClientId(),
            e.getDirection(),
            e.getChannel(),
            e.getTemplateId(),
            e.getTriggerId(),
            e.getSubject(),
            e.getBody(),
            e.getDeliveryStatus(),
            e.getProviderMessageId(),
            e.getSentAt(),
            e.getCreatedAt(),
            e.getErrorCode(),
            e.getErrorMessage(),
            e.getRetryOfMessageId(),
            e.getRetryAttempt() == null ? 1 : e.getRetryAttempt());
    }
}
