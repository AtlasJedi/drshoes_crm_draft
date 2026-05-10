package com.drshoes.app.messaging.service;

import com.drshoes.app.audit.Audited;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Write-side service: mutations on message threads.
 * Read-side find-or-create operations stay in {@link MessageThreadService}.
 *
 * All three public methods are annotated with {@code @Audited(parent = "#threadId")}.
 * The SpEL resolves via {@code Parameter#getName()} — works because the project
 * compiles with {@code -parameters} (set in parent pom.xml maven-compiler-plugin).
 */
@Service
public class MessageThreadMutationService {

    private static final Logger log = LoggerFactory.getLogger(MessageThreadMutationService.class);

    private final MessageThreadRepository threads;
    private final MessageRepository messages;

    public MessageThreadMutationService(MessageThreadRepository threads,
                                        MessageRepository messages) {
        this.threads  = threads;
        this.messages = messages;
    }

    @Transactional
    @Audited(parent = "#threadId")
    public MessageThreadEntity markRead(UUID threadId, AdminPrincipal actor) {
        log.info("op=thread.markRead actor={} threadId={}", actor.email(), threadId);
        var t = require(threadId);
        t.setUnreadCount(0);
        var saved = threads.save(t);
        log.info("op=thread.markRead actor={} threadId={} outcome=ok", actor.email(), threadId);
        return saved;
    }

    @Transactional
    @Audited(parent = "#threadId")
    public MessageThreadEntity assignUnmatched(UUID threadId, UUID targetClientId,
                                               AdminPrincipal actor) {
        log.info("op=thread.assign actor={} threadId={} targetClientId={}",
            actor.email(), threadId, targetClientId);
        var t = require(threadId);
        if (t.getClientId() != null) {
            log.info("op=thread.assign actor={} threadId={} outcome=conflict_already_assigned",
                actor.email(), threadId);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Thread already assigned to a client");
        }
        t.setClientId(targetClientId);
        t.setRawSender(null);
        messages.bulkUpdateClientIdByThreadId(threadId, targetClientId);
        var saved = threads.save(t);
        log.info("op=thread.assign actor={} threadId={} outcome=ok", actor.email(), threadId);
        return saved;
    }

    @Transactional
    @Audited(parent = "#threadId")
    public MessageThreadEntity discardUnmatched(UUID threadId, AdminPrincipal actor) {
        log.info("op=thread.discard actor={} threadId={}", actor.email(), threadId);
        var t = require(threadId);
        if (t.getDiscardedAt() != null) {
            log.info("op=thread.discard actor={} threadId={} outcome=conflict_already_discarded",
                actor.email(), threadId);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Thread already discarded");
        }
        t.setDiscardedAt(OffsetDateTime.now(ZoneOffset.UTC));
        var saved = threads.save(t);
        log.info("op=thread.discard actor={} threadId={} outcome=ok", actor.email(), threadId);
        return saved;
    }

    // ---- private ----

    private MessageThreadEntity require(UUID threadId) {
        return threads.findById(threadId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Thread not found: " + threadId));
    }
}
