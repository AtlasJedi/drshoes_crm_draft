package com.drshoes.app;

import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.UUID;

/**
 * Base class for admin controller integration tests.
 *
 * Provides a session-aware MockMvc wrapper that injects Spring Security principal
 * via SecurityMockMvcRequestPostProcessors.user(), so no HTTP login round-trip
 * is needed. The DB still has real OWNER + EMPLOYEE rows for FK integrity.
 *
 * Usage:
 *   loginAsOwner();
 *   mockMvc().perform(get("/api/admin/clients")).andExpect(status().isOk());
 *
 * State-changing calls MUST add .with(csrf()) from SecurityMockMvcRequestPostProcessors.
 */
@AutoConfigureMockMvc
public abstract class AdminWebTestBase extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private UserRepository users;
    @Autowired private PasswordEncoder enc;
    @Autowired private ClientRepository clients;
    @Autowired private AuditLogRepository auditLogs;

    /** Current principal injector; null = anonymous. */
    private RequestPostProcessor principalProcessor;

    @BeforeEach
    void seedUsers() {
        // audit_log.actor_id is a FK to user_(id) — clear audit rows first
        auditLogs.deleteAll();
        clients.deleteAll();
        users.deleteAll();
        principalProcessor = null;

        var owner = new User();
        owner.setEmail("owner@test.pl");
        owner.setPasswordHash(enc.encode("pass"));
        owner.setFullName("Owner Test");
        owner.setRole(UserRole.OWNER);

        var emp = new User();
        emp.setEmail("emp@test.pl");
        emp.setPasswordHash(enc.encode("pass"));
        emp.setFullName("Employee Test");
        emp.setRole(UserRole.EMPLOYEE);

        users.saveAll(List.of(owner, emp));
    }

    @AfterEach
    void cleanupUsers() {
        // audit_log.actor_id is a FK to user_(id) — clear audit rows first
        auditLogs.deleteAll();
        clients.deleteAll();
        users.deleteAll();
        principalProcessor = null;
    }

    /**
     * Injects an {@link AdminPrincipal}-backed authentication into MockMvc requests
     * so that {@code @AuthenticationPrincipal AdminPrincipal actor} resolves correctly
     * in controllers. Returns the seeded owner's UUID for assertion use in tests.
     */
    protected UUID loginAsOwner() {
        User owner = users.findByEmailIgnoreCase("owner@test.pl").orElseThrow(
            () -> new IllegalStateException("Owner not seeded"));
        var principal = new AdminPrincipal(owner.getId(), owner.getEmail(), "OWNER");
        var auth = UsernamePasswordAuthenticationToken.authenticated(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        principalProcessor = SecurityMockMvcRequestPostProcessors.authentication(auth);
        return owner.getId();
    }

    protected UUID loginAsEmployee() {
        User emp = users.findByEmailIgnoreCase("emp@test.pl").orElseThrow(
            () -> new IllegalStateException("Employee not seeded"));
        var principal = new AdminPrincipal(emp.getId(), emp.getEmail(), "EMPLOYEE");
        var auth = UsernamePasswordAuthenticationToken.authenticated(
            principal, null, List.of(new SimpleGrantedAuthority("ROLE_EMPLOYEE")));
        principalProcessor = SecurityMockMvcRequestPostProcessors.authentication(auth);
        return emp.getId();
    }

    /**
     * Returns a wrapper that transparently injects the current principal (if any)
     * into every perform() call. Unauthenticated requests have no processor.
     */
    protected SessionAwareMockMvc mockMvc() {
        return new SessionAwareMockMvc(mvc, principalProcessor);
    }

    /**
     * Creates a minimal Client via the repository and returns its id.
     */
    protected UUID createClientAndReturnId() {
        var c = new Client();
        c.setFirstName("Test");
        c.setLastName("Client");
        c.setPhone("+48 600 000 001");
        return clients.save(c).getId();
    }

    // ---------------------------------------------------------------------- inner class

    /**
     * Thin MockMvc wrapper that transparently injects the current principal post-processor
     * into every perform() call, so tests don't need to manually add .with(user(...)).
     */
    public static class SessionAwareMockMvc {

        private final MockMvc delegate;
        private final RequestPostProcessor principalProcessor;

        SessionAwareMockMvc(MockMvc delegate, RequestPostProcessor principalProcessor) {
            this.delegate = delegate;
            this.principalProcessor = principalProcessor;
        }

        public org.springframework.test.web.servlet.ResultActions perform(
                MockHttpServletRequestBuilder builder) throws Exception {
            if (principalProcessor != null) {
                builder.with(principalProcessor);
            }
            return delegate.perform(builder);
        }
    }
}
