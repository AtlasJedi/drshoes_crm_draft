package com.drshoes.app.messaging.domain;

import com.drshoes.lib.messaging.Provider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
public interface WebhookEventRepository extends JpaRepository<WebhookEventEntity, UUID> {
    Optional<WebhookEventEntity> findByProviderAndProviderEventId(
            Provider provider, String providerEventId);
}
