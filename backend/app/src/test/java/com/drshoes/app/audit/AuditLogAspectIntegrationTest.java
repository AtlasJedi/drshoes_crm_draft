package com.drshoes.app.audit;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import com.drshoes.app.auth.api.dto.LoginRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class AuditLogAspectIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder enc;
    @Autowired AuditLogRepository auditLog;

    @BeforeEach
    void seed() {
        auditLog.deleteAll();
        users.deleteAll();
        var u = new User();
        u.setEmail("misza@drshoes.pl");
        u.setPasswordHash(enc.encode("p"));
        u.setFullName("M");
        u.setRole(UserRole.OWNER);
        users.save(u);
    }

    @AfterEach
    void cleanup() {
        auditLog.deleteAll();
        users.deleteAll();
    }

    @Test
    void login_writes_audit_log_row() {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("misza@drshoes.pl", "p"), headers), String.class);
        long count = auditLog.count();
        assertThat(count).isEqualTo(1);   // exactly one row — primary handler only
    }

    @Test
    void failed_login_writes_exactly_one_audit_row() {
        // Regression test for the @ExceptionHandler double-audit bug:
        // before the pointcut excluded @ExceptionHandler methods, a wrong-password
        // login produced two rows — one from the primary handler (status=500) and
        // one from handleInvalidCredentials (status=401). After the fix, exactly
        // one row is written, and its status reflects the rethrown-exception path.
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("misza@drshoes.pl", "wrong"), headers), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(auditLog.count()).isEqualTo(1);
    }
}
