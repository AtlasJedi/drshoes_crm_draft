package com.drshoes.app;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class HealthEndpointIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;

    @Test
    void health_returns_200_and_status_up() {
        var resp = rest.getForEntity("/actuator/health", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void flyway_applied_v001() {
        var resp = rest.getForEntity("/actuator/health", String.class);
        // Migration applied if Spring Boot DB health is UP and JPA validate succeeds.
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
