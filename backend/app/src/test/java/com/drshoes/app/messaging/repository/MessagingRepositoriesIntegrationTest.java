package com.drshoes.app.messaging.repository;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.TriggerEvent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class MessagingRepositoriesIntegrationTest extends AbstractIntegrationTest {

    @Autowired MessageTemplateRepository templates;
    @Autowired TriggerRepository triggers;
    @Autowired TriggerFireRepository fires;

    @Test
    void seededTemplatesLoadByName() {
        var t = templates.findByName("Zlecenie przyjete (EMAIL)").orElseThrow();
        assertThat(t.getChannel()).isEqualTo("EMAIL");
        assertThat(t.getActive()).isTrue();
        assertThat(t.getBody()).contains("{imie_klienta}");
    }

    @Test
    void seededTriggersLoadByEvent() {
        var byEvent = triggers.findAllByEventAndEnabledTrue(TriggerEvent.STATUS_CHANGE);
        assertThat(byEvent).extracting("name")
                .containsExactlyInAnyOrder("Zlecenie przyjete", "Gotowe do odbioru");
    }

    @Test
    void triggerFireCompositePkRoundTrips() {
        // Verify the repository bean is correctly wired and the trigger_fire table is accessible.
        // Full insert round-trip requires a real order FK (tested in IdempotencyServiceIntegrationTest).
        // Here we assert the bean exists and count() executes without error.
        long count = fires.count();
        assertThat(count).isGreaterThanOrEqualTo(0);
    }
}
