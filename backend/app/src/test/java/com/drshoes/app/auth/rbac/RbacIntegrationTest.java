package com.drshoes.app.auth.rbac;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.auth.api.dto.LoginRequest;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test for RBAC enforcement via @PreAuthorize.
 *
 * The inner TestEndpoints @RestController is NOT auto-scanned by @SpringBootTest
 * (test classes are outside the main component-scan path). It is registered
 * explicitly via @TestConfiguration + @Import — deviation from the plan's
 * "no extra wiring needed" comment, logged in dispatch log.
 */
@Import(RbacIntegrationTest.TestEndpointsConfig.class)
class RbacIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder enc;
    @Autowired AuditLogRepository auditLogs;

    @AfterEach
    void cleanup() {
        // audit_log.actor_id FK to user_(id) — clear audit rows first
        auditLogs.deleteAll();
        users.deleteAll();
    }

    @BeforeEach
    void seed() {
        auditLogs.deleteAll();
        users.deleteAll();
        var owner = new User();
        owner.setEmail("owner@x");
        owner.setPasswordHash(enc.encode("p"));
        owner.setFullName("O");
        owner.setRole(UserRole.OWNER);
        var emp = new User();
        emp.setEmail("emp@x");
        emp.setPasswordHash(enc.encode("p"));
        emp.setFullName("E");
        emp.setRole(UserRole.EMPLOYEE);
        users.saveAll(List.of(owner, emp));
    }

    @Test
    void employee_cannot_call_owner_only_test_endpoint() {
        var cookies = login("emp@x", "p");
        var headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, cookies);
        var resp = rest.exchange("/test/owner-only", HttpMethod.GET,
            new HttpEntity<>(headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void owner_can_call_owner_only_test_endpoint() {
        var cookies = login("owner@x", "p");
        var headers = new HttpHeaders();
        headers.put(HttpHeaders.COOKIE, cookies);
        var resp = rest.exchange("/test/owner-only", HttpMethod.GET,
            new HttpEntity<>(headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    private List<String> login(String email, String pass) {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest(email, pass), headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        return resp.getHeaders().get("Set-Cookie");
    }

    /**
     * Registers the test-only @RestController into the Spring Boot test context.
     * Required because @SpringBootTest scans main sources, not test class inner types.
     */
    @TestConfiguration
    static class TestEndpointsConfig {
        @org.springframework.context.annotation.Bean
        TestEndpoints testEndpoints() {
            return new TestEndpoints();
        }
    }

    /**
     * Test-only endpoint that exercises @PreAuthorize RBAC enforcement end-to-end.
     * GET request — CSRF does not apply.
     */
    @RestController
    @RequestMapping("/test")
    static class TestEndpoints {
        @GetMapping("/owner-only")
        @PreAuthorize("@rbac.canManageUsers(authentication)")
        public String ownerOnly() {
            return "ok";
        }
    }
}
