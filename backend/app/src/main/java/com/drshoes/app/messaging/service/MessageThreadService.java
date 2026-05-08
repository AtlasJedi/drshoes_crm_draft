package com.drshoes.app.messaging.service;

import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class MessageThreadService {

  private static final Logger log = LoggerFactory.getLogger(MessageThreadService.class);

  private final MessageThreadRepository threads;

  public MessageThreadService(MessageThreadRepository threads) {
    this.threads = threads;
  }

  @Transactional
  public MessageThreadEntity findOrCreateForClient(UUID clientId) {
    return threads.findFirstByClientIdOrderByCreatedAtAsc(clientId)
        .orElseGet(() -> {
          var t = new MessageThreadEntity();
          t.setClientId(clientId);
          t.setUnreadCount(0);
          MessageThreadEntity saved = threads.save(t);
          log.info("op=thread.create clientId={} threadId={}", clientId, saved.getId());
          return saved;
        });
  }
}
