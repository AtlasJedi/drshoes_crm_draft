package com.drshoes.app.otel;

import com.drshoes.app.AbstractIntegrationTest;
import io.opentelemetry.api.OpenTelemetry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that the OTel Spring Boot starter registers an OpenTelemetry bean
 * in the application context. This is the minimum smoke test for task 8-4.
 * Real span emission is tested in tasks 8-6 and 8-7.
 */
class OtelContextLoadsIntegrationTest extends AbstractIntegrationTest {

    @Autowired(required = false)
    OpenTelemetry openTelemetry;

    @Test
    void openTelemetry_bean_is_present() {
        assertThat(openTelemetry)
            .as("OpenTelemetry bean must be registered by the OTel Spring Boot starter")
            .isNotNull();
    }
}
