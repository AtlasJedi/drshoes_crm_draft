package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Read-side service: find-or-create operations for message threads.
 * Write-side mutations (markRead, assignUnmatched, discardUnmatched) live in
 * {@link MessageThreadMutationService} to stay within the 120-LOC cap.
 */
@Service
public class MessageThreadService {

    private static final Logger log = LoggerFactory.getLogger(MessageThreadService.class);

    private final MessageThreadRepository threads;

    public MessageThreadService(MessageThreadRepository threads) {
        this.threads = threads;
    }

    /** Retained for M2/M4 callers that pass clientId only (EMAIL assumed). */
    @Transactional
    public MessageThreadEntity findOrCreateForClient(UUID clientId) {
        return findOrCreateForClient(clientId, "EMAIL");
    }

    @Transactional
    public MessageThreadEntity findOrCreateForClient(UUID clientId, String channel) {
        return threads.findFirstByClientIdAndChannelOrderByCreatedAtAsc(clientId, channel)
            .orElseGet(() -> {
                var t = new MessageThreadEntity();
                t.setClientId(clientId);
                t.setChannel(channel);
                t.setUnreadCount(0);
                var saved = threads.save(t);
                log.info("op=thread.create clientId={} channel={} threadId={}",
                    clientId, channel, saved.getId());
                return saved;
            });
    }

    @Transactional
    public MessageThreadEntity findOrCreateForRawSender(String rawSender, String channel) {
        return threads.findFirstByRawSenderAndChannelOrderByCreatedAtAsc(rawSender, channel)
            .orElseGet(() -> {
                var t = new MessageThreadEntity();
                t.setRawSender(rawSender);
                t.setChannel(channel);
                t.setUnreadCount(0);
                var saved = threads.save(t);
                log.info("op=thread.createUnmatched rawSender={} channel={} threadId={}",
                    rawSender, channel, saved.getId());
                return saved;
            });
    }
}
