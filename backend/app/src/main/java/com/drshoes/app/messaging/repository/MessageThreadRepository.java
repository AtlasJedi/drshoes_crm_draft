package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.MessageThreadEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MessageThreadRepository extends JpaRepository<MessageThreadEntity, UUID> {
    Optional<MessageThreadEntity> findFirstByClientIdOrderByCreatedAtAsc(UUID clientId);
}
