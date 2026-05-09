package com.drshoes.app.messaging.domain;

import com.drshoes.lib.messaging.Provider;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@Testcontainers
class WebhookEventRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
    }

    @Autowired
    WebhookEventRepository repo;

    @Test
    @DisplayName("save and retrieve roundtrip preserves all columns")
    void saveAndRetrieve() {
        WebhookEventEntity entity = new WebhookEventEntity();
        entity.setProvider(Provider.POSTMARK);
        entity.setProviderEventId(null);
        entity.setProviderMessageId("pm-msg-abc123");
        entity.setEventType("Delivery");
        entity.setAppliedStatus(WebhookEventEntity.AppliedStatus.DELIVERED);
        entity.setAppliedOutcome(WebhookEventEntity.AppliedOutcome.APPLIED);
        entity.setRawPayload(JsonNodeFactory.instance.objectNode().put("RecordType", "Delivery"));
        entity.setReceivedAt(Instant.now());
        entity.setAppliedAt(Instant.now());

        WebhookEventEntity saved = repo.save(entity);
        repo.flush();

        Optional<WebhookEventEntity> found = repo.findById(saved.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getProvider()).isEqualTo(Provider.POSTMARK);
        assertThat(found.get().getProviderMessageId()).isEqualTo("pm-msg-abc123");
        assertThat(found.get().getEventType()).isEqualTo("Delivery");
        assertThat(found.get().getAppliedStatus()).isEqualTo(WebhookEventEntity.AppliedStatus.DELIVERED);
        assertThat(found.get().getAppliedOutcome()).isEqualTo(WebhookEventEntity.AppliedOutcome.APPLIED);
        assertThat(found.get().getAppliedAt()).isNotNull();
    }

    @Test
    @DisplayName("UNIQUE(provider, provider_event_id) raises DataIntegrityViolationException on conflict")
    void uniqueConstraintOnProviderEventId() {
        String eventId = "smsapi-event-xyz";

        WebhookEventEntity first = buildEntity(Provider.SMSAPI, eventId, "DELIVERED");
        repo.saveAndFlush(first);

        WebhookEventEntity duplicate = buildEntity(Provider.SMSAPI, eventId, "DELIVERED");

        assertThatThrownBy(() -> repo.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("multiple rows with NULL provider_event_id are allowed (partial unique index)")
    void nullProviderEventIdAllowsMultipleRows() {
        WebhookEventEntity e1 = buildEntity(Provider.POSTMARK, null, "Delivery");
        WebhookEventEntity e2 = buildEntity(Provider.POSTMARK, null, "Delivery");

        repo.saveAndFlush(e1);
        repo.saveAndFlush(e2);

        assertThat(repo.findAll()).hasSizeGreaterThanOrEqualTo(2);
    }

    // ---- helpers ----

    private WebhookEventEntity buildEntity(Provider provider, String eventId, String eventType) {
        WebhookEventEntity e = new WebhookEventEntity();
        e.setProvider(provider);
        e.setProviderEventId(eventId);
        e.setProviderMessageId("msg-" + System.nanoTime());
        e.setEventType(eventType);
        e.setAppliedOutcome(WebhookEventEntity.AppliedOutcome.DROPPED);
        e.setRawPayload(JsonNodeFactory.instance.objectNode());
        e.setReceivedAt(Instant.now());
        return e;
    }
}
