package com.drshoes.app.messaging.domain;

import com.drshoes.lib.messaging.Provider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data repository for {@link WebhookEventEntity}.
 *
 * <p>{@code findByProviderAndProviderEventId} drives the in-memory dedupe path
 * (pre-INSERT lookup) in {@code WebhookStatusReconciler}.
 * The DB-level dedupe is the UNIQUE partial index — this query is a secondary defence.</p>
 */
public interface WebhookEventRepository extends JpaRepository<WebhookEventEntity, UUID> {

    /**
     * Returns the existing webhook event log row for (provider, provider_event_id),
     * or empty if no row exists or provider_event_id is null.
     */
    Optional<WebhookEventEntity> findByProviderAndProviderEventId(
            Provider provider, String providerEventId);
}
