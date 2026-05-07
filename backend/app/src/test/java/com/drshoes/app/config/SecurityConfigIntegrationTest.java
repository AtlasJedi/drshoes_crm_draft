package com.drshoes.app.config;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;

    @Test
    void actuator_health_is_public() {
        var resp = rest.getForEntity("/actuator/health", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void admin_endpoints_require_auth() {
        var resp = rest.getForEntity("/api/admin/auth/me", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void public_routes_are_open() {
        var resp = rest.getForEntity("/api/public/news", String.class);
        // Endpoint doesn't exist yet (Milestone 5) but security must NOT 401 it.
        // Expect 404 or method-not-allowed (anything but 401/403).
        assertThat(resp.getStatusCode()).isNotIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
    }
}
