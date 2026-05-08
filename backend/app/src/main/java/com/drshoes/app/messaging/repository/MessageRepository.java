package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.MessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {
    List<MessageEntity> findAllByOrderIdOrderByCreatedAtAsc(UUID orderId);
}
