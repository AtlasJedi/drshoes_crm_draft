package com.drshoes.app.messaging.repository;

import com.drshoes.app.messaging.domain.MessageTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageTemplateRepository extends JpaRepository<MessageTemplateEntity, UUID> {
    Optional<MessageTemplateEntity> findByName(String name);
    List<MessageTemplateEntity> findAllByActiveTrue();
}
