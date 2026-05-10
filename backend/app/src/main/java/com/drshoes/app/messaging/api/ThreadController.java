package com.drshoes.app.messaging.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.dto.MessageDto;
import com.drshoes.app.messaging.dto.MessageThreadDto;
import com.drshoes.app.messaging.dto.ThreadDetailDto;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Read-only thread endpoints (list + get-by-id).
 * POST mutations (mark-read, assign, discard) live in ThreadMutationController.
 * LOC target: &lt; 120.
 */
@RestController
@RequestMapping("/api/admin/threads")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ThreadController {

    private static final Logger log = LoggerFactory.getLogger(ThreadController.class);

    private final MessageThreadRepository threads;
    private final MessageRepository messages;
    private final ClientRepository clients;

    public ThreadController(MessageThreadRepository threads,
                            MessageRepository messages,
                            ClientRepository clients) {
        this.threads  = threads;
        this.messages = messages;
        this.clients  = clients;
    }

    @GetMapping
    public List<MessageThreadDto> list(
            @RequestParam(defaultValue = "ALL") String filter,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID clientId,
            @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=threads.list actor={} clientId={} filter={} channel={} q={}",
            actor.email(), clientId, filter, channel, q);
        List<MessageThreadEntity> raw;
        if (clientId != null) {
            raw = threads.findAllByClientIdAndDiscardedAtIsNullOrderByLastMessageAtDesc(clientId);
            Map<UUID, Client> clientsById = loadClients(raw);
            log.info("op=threads.list actor={} clientId={} outcome=ok count={}",
                actor.email(), clientId, raw.size());
            return raw.stream()
                .map(t -> toDto(t, t.getClientId() == null ? null : clientsById.get(t.getClientId())))
                .toList();
        }
        if (q != null && q.length() >= 2) {
            raw = threads.searchThreads(q, channel);
        } else {
            raw = switch (filter.toUpperCase()) {
                case "UNREAD"    -> threads.findAllWithUnreadOrderByLastMessageAtDesc(channel);
                case "UNMATCHED" -> threads.findAllUnmatchedOrderByLastMessageAtDesc(channel);
                default          -> threads.findAllActiveOrderByLastMessageAtDesc(channel);
            };
        }
        Map<UUID, Client> clientsById = loadClients(raw);
        log.info("op=threads.list actor={} outcome=ok count={}", actor.email(), raw.size());
        return raw.stream()
            .map(t -> toDto(t, t.getClientId() == null ? null : clientsById.get(t.getClientId())))
            .toList();
    }

    @GetMapping("/{id}")
    public ThreadDetailDto getThread(@PathVariable UUID id,
                                     @AuthenticationPrincipal AdminPrincipal actor) {
        log.info("op=threads.get actor={} threadId={}", actor.email(), id);
        var t = threads.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Thread not found"));
        Client client = t.getClientId() == null ? null
            : clients.findById(t.getClientId()).orElse(null);
        var msgs = messages.findAllByThreadIdOrderByCreatedAtAsc(id)
            .stream().map(this::toMessageDto).toList();
        log.info("op=threads.get actor={} threadId={} outcome=ok messages={}", actor.email(), id, msgs.size());
        return new ThreadDetailDto(toDto(t, client), msgs);
    }

    // ---- private helpers ----

    private Map<UUID, Client> loadClients(List<MessageThreadEntity> ts) {
        var ids = ts.stream().map(MessageThreadEntity::getClientId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return clients.findAllById(ids).stream()
            .collect(Collectors.toMap(Client::getId, c -> c));
    }

    private MessageThreadDto toDto(MessageThreadEntity t, Client client) {
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

    private MessageDto toMessageDto(MessageEntity m) {
        return new MessageDto(m.getId(), m.getOrderId(), m.getClientId(), m.getDirection(),
            m.getChannel(), m.getTemplateId(), m.getTriggerId(), m.getSubject(), m.getBody(),
            m.getDeliveryStatus(), m.getProviderMessageId(), m.getSentAt(), m.getCreatedAt(),
            m.getErrorCode(), m.getErrorMessage(), m.getRetryOfMessageId(),
            m.getRetryAttempt() == null ? 1 : m.getRetryAttempt(),
            m.getThreadId());
    }
}
