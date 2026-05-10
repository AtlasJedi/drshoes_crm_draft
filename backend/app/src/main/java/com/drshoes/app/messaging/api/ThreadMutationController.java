package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.dto.AssignThreadRequest;
import com.drshoes.app.messaging.dto.MessageThreadDto;
import com.drshoes.app.messaging.service.MessageThreadMutationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Write-side thread endpoints: mark-read, assign, discard.
 * Reply endpoint (POST /threads/{id}/messages) lives in ThreadReplyController (task 5-10).
 * GET endpoints live in ThreadController.
 * LOC target: &lt; 80.
 */
@RestController
@RequestMapping("/api/admin/threads")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ThreadMutationController {

    private static final Logger log = LoggerFactory.getLogger(ThreadMutationController.class);

    private final MessageThreadMutationService mutationService;
    private final ClientRepository clients;

    public ThreadMutationController(MessageThreadMutationService mutationService,
                                    ClientRepository clients) {
        this.mutationService = mutationService;
        this.clients         = clients;
    }

    @PostMapping("/{id}/mark-read")
    public MessageThreadDto markRead(@PathVariable UUID id,
                                     @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.markRead actor={} threadId={}", actor.email(), id);
        var t = mutationService.markRead(id, actor);
        log.info("op=thread.markRead actor={} threadId={} outcome=ok", actor.email(), id);
        return toDto(t);
    }

    @PostMapping("/{id}/assign")
    public MessageThreadDto assign(@PathVariable UUID id,
                                   @RequestBody AssignThreadRequest req,
                                   @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.assign actor={} threadId={} targetClientId={}",
            actor.email(), id, req.clientId());
        var t = mutationService.assignUnmatched(id, req.clientId(), actor);
        log.info("op=thread.assign actor={} threadId={} outcome=ok", actor.email(), id);
        return toDto(t);
    }

    @PostMapping("/{id}/discard")
    public MessageThreadDto discard(@PathVariable UUID id,
                                    @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=thread.discard actor={} threadId={}", actor.email(), id);
        var t = mutationService.discardUnmatched(id, actor);
        log.info("op=thread.discard actor={} threadId={} outcome=ok", actor.email(), id);
        return toDto(t);
    }

    // ---- private helpers ----

    private MessageThreadDto toDto(MessageThreadEntity t) {
        Client client = t.getClientId() == null ? null
            : clients.findById(t.getClientId()).orElse(null);
        return new MessageThreadDto(
            t.getId(), t.getClientId(), t.getRawSender(), t.getChannel(), t.getSubject(),
            t.getLastMessageAt(), t.getUnreadCount(), t.getCreatedAt(), t.getUpdatedAt(),
            null /* lastMessagePreview — not stored on entity */,
            t.getClientId() == null,
            client == null ? null : client.getFullName(),
            client == null ? null : client.getEmail(),
            client == null ? null : client.getPhone(),
            t.getDiscardedAt());
    }
}
