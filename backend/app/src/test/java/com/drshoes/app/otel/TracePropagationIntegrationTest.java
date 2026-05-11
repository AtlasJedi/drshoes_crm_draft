package com.drshoes.app.otel;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the server accepts and does not strip the W3C traceparent header.
 * The OTel auto-instrumentation (when active) picks this up; here we only verify
 * the header is not rejected by the Spring Security filter chain or any middleware.
 *
 * A real span-correlation test requires the OTel SDK to be active in the JVM,
 * which is done via the -javaagent path; that level of verification happens at
 * the Playwright E2E layer (Wave 7).
 */
class TracePropagationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    void healthEndpointAcceptsTraceparentHeader() {
        var headers = new HttpHeaders();
        headers.set("traceparent",
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
        var entity = new HttpEntity<>(headers);

        var response = rest.exchange(
            "/actuator/health",
            HttpMethod.GET,
            entity,
            String.class
        );

        // Server must not reject the request due to the traceparent header
        assertThat(response.getStatusCode()).isIn(
            HttpStatus.OK, HttpStatus.SERVICE_UNAVAILABLE
        );
    }

    @Test
    void serverDoesNotReflectTraceparentInResponseByDefault() {
        var headers = new HttpHeaders();
        headers.set("traceparent",
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
        var entity = new HttpEntity<>(headers);

        var response = rest.exchange(
            "/actuator/health",
            HttpMethod.GET,
            entity,
            String.class
        );

        // traceparent should not be echoed back — no reflection risk
        assertThat(response.getHeaders().containsKey("traceparent")).isFalse();
    }
}
