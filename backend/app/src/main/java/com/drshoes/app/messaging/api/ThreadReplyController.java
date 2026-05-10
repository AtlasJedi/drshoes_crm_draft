package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.SendReplyRequest;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import com.drshoes.app.messaging.service.MessageRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * POST /api/admin/threads/{id}/messages — send a reply on an existing thread.
 * Validates: thread exists (404), matched client (422), not discarded (422),
 * channel match (400). Delegates to MessageRouter.sendReply. Returns MessageDto 200.
 * LOC target: &lt; 70.
 */
@RestController
@RequestMapping("/api/admin/threads")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ThreadReplyController {

    private static final Logger log = LoggerFactory.getLogger(ThreadReplyController.class);

    private final MessageThreadRepository threads;
    private final MessageRepository messages;
    private final MessageRouter router;

    public ThreadReplyController(MessageThreadRepository threads,
                                 MessageRepository messages,
                                 MessageRouter router) {
        this.threads  = threads;
        this.messages = messages;
        this.router   = router;
    }

    @PostMapping("/{id}/messages")
    public MessageDto sendReply(@PathVariable UUID id,
                                @RequestBody SendReplyRequest req,
                                @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.sendReply actor={} threadId={} channel={}", actor.email(), id, req.channel());

        var thread = threads.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));

        if (thread.getClientId() == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Cannot reply to unmatched thread — assign to a client first");
        }
        if (thread.getDiscardedAt() != null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "Cannot reply to discarded thread");
        }
        if (!thread.getChannel().equalsIgnoreCase(req.channel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Channel mismatch: thread is " + thread.getChannel()
                + " but request specifies " + req.channel());
        }

        UUID messageId = router.sendReply(id, thread.getClientId(), req.channel(),
            req.subject(), req.body(), req.orderId(), actor);

        var msg = messages.findById(messageId)
            .orElseThrow(() -> new IllegalStateException("Message not found after send: " + messageId));

        log.info("op=thread.sendReply actor={} threadId={} messageId={} outcome=ok",
            actor.email(), id, messageId);

        return toDto(msg);
    }

    // ---- private ----

    private MessageDto toDto(com.drshoes.app.messaging.domain.MessageEntity m) {
        return new MessageDto(m.getId(), m.getOrderId(), m.getClientId(), m.getDirection(),
            m.getChannel(), m.getTemplateId(), m.getTriggerId(), m.getSubject(), m.getBody(),
            m.getDeliveryStatus(), m.getProviderMessageId(), m.getSentAt(), m.getCreatedAt(),
            m.getErrorCode(), m.getErrorMessage(), m.getRetryOfMessageId(),
            m.getRetryAttempt() == null ? 1 : m.getRetryAttempt());
    }
}
