package com.drshoes.app.auth.principal;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.audit.AuditLogRepository;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.auth.service.AuthService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that a successful login produces an {@link AdminPrincipal} in the
 * SecurityContext, with the correct userId, email, and role fields.
 *
 * Uses {@link AuthService#login} directly (bypasses MockMvc) so we can inspect
 * the SecurityContextHolder after the call — MockMvc's
 * {@code SecurityMockMvcRequestPostProcessors.user()} injects a synthetic
 * principal only into the request scope, not into the SecurityContextHolder.
 *
 * Three assertions per the plan:
 *   1. Successful login → principal is AdminPrincipal with right userId/email/role.
 *   2. auth.getName() still returns email (backwards-compat for existing callers).
 *   3. Session round-trip: principal carries a non-null userId UUID.
 */
class AdminPrincipalLoginTest extends AbstractIntegrationTest {

    @Autowired AuthService authService;
    @Autowired UserRepository users;
    @Autowired AuditLogRepository auditLogs;
    @Autowired PasswordEncoder enc;

    private User owner;

    @BeforeEach
    void seed() {
        // audit_log.actor_id has FK → user_(id); clear children before parents.
        auditLogs.deleteAll();
        users.deleteAll();
        owner = new User();
        owner.setEmail("owner@drshoes.pl");
        owner.setPasswordHash(enc.encode("SecretPass1!"));
        owner.setFullName("Misza Owner");
        owner.setRole(UserRole.OWNER);
        owner = users.save(owner);
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        auditLogs.deleteAll();
        users.deleteAll();
    }

    @Test
    void afterLogin_principalIsAdminPrincipalRecordCarryingUserUuid() {
        var req = new MockHttpServletRequest();
        req.setRemoteAddr("127.0.0.1");

        authService.login("owner@drshoes.pl", "SecretPass1!", req);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.isAuthenticated()).isTrue();

        // 1. Principal type and fields
        assertThat(auth.getPrincipal()).isInstanceOf(AdminPrincipal.class);
        var principal = (AdminPrincipal) auth.getPrincipal();
        assertThat(principal.userId()).isEqualTo(owner.getId());
        assertThat(principal.email()).isEqualTo("owner@drshoes.pl");
        assertThat(principal.role()).isEqualTo("OWNER");

        // 2. Backwards-compat: getName() returns email via toString()
        assertThat(auth.getName()).isEqualTo("owner@drshoes.pl");

        // 3. userId is non-null — session round-trip carries real UUID actor_id
        assertThat(principal.userId()).isNotNull();
    }

    @Test
    void adminPrincipal_isSerializable() throws Exception {
        // Spring Session JDBC serializes the SecurityContext to a blob.
        // Verify AdminPrincipal round-trips through Java serialization without error.
        var p = new AdminPrincipal(owner.getId(), owner.getEmail(), "OWNER");

        var baos = new java.io.ByteArrayOutputStream();
        try (var oos = new java.io.ObjectOutputStream(baos)) {
            oos.writeObject(p);
        }

        try (var ois = new java.io.ObjectInputStream(
                new java.io.ByteArrayInputStream(baos.toByteArray()))) {
            var deserialized = (AdminPrincipal) ois.readObject();
            assertThat(deserialized.userId()).isEqualTo(p.userId());
            assertThat(deserialized.email()).isEqualTo(p.email());
            assertThat(deserialized.role()).isEqualTo(p.role());
        }
    }
}
