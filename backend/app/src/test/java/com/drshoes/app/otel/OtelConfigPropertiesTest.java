package com.drshoes.app.otel;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that the OTel YAML configuration binds without errors and that
 * key values are present in the resolved environment.
 *
 * Uses AbstractIntegrationTest (full context, Testcontainers Postgres) to ensure
 * Flyway + JPA still boot correctly with the new otel: block in application.yaml.
 */
class OtelConfigPropertiesTest extends AbstractIntegrationTest {

    @Value("${otel.exporter.otlp.protocol:MISSING}")
    String otlpProtocol;

    @Value("${otel.traces.sampler:MISSING}")
    String sampler;

    @Value("${drshoes.demo.seed.enabled:MISSING}")
    String demoSeedEnabled;

    @Test
    void otel_otlp_protocol_is_http_protobuf() {
        assertThat(otlpProtocol)
            .as("otel.exporter.otlp.protocol must be http/protobuf")
            .isEqualTo("http/protobuf");
    }

    @Test
    void otel_traces_sampler_is_always_on() {
        assertThat(sampler)
            .as("otel.traces.sampler must be always_on")
            .isEqualTo("always_on");
    }

    @Test
    void demo_seed_enabled_property_resolves() {
        // In test profile the value should resolve (not be MISSING).
        // It may be true (if test profile has local overlay) or false (default).
        assertThat(demoSeedEnabled)
            .as("drshoes.demo.seed.enabled must resolve from YAML (not remain MISSING)")
            .isNotEqualTo("MISSING");
    }
}
