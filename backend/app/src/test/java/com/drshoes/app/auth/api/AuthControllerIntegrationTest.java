package com.drshoes.app.auth.api;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.auth.api.dto.LoginRequest;
import com.drshoes.app.auth.api.dto.MeResponse;
import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.domain.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder enc;

    @AfterEach
    void cleanup() {
        users.deleteAll();
    }

    @BeforeEach
    void seed() {
        users.deleteAll();
        var u = new User();
        u.setEmail("misza@drshoes.pl");
        u.setPasswordHash(enc.encode("CorrectHorse"));
        u.setFullName("Misza Doctor");
        u.setRole(UserRole.OWNER);
        users.save(u);
    }

    @Test
    void login_then_me_returns_user() {
        // Login
        var loginResp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("misza@drshoes.pl", "CorrectHorse"),
                             jsonHeaders()),
            String.class);
        assertThat(loginResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        var sessionCookie = loginResp.getHeaders().get("Set-Cookie");
        assertThat(sessionCookie).isNotEmpty();

        // Me
        var meHeaders = new HttpHeaders();
        meHeaders.put(HttpHeaders.COOKIE, sessionCookie);
        var meResp = rest.exchange("/api/admin/auth/me", HttpMethod.GET,
            new HttpEntity<>(meHeaders), MeResponse.class);
        assertThat(meResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(meResp.getBody().email()).isEqualTo("misza@drshoes.pl");
        assertThat(meResp.getBody().role()).isEqualTo(UserRole.OWNER);
    }

    @Test
    void wrong_password_returns_401() {
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("misza@drshoes.pl", "WrongPass"),
                             jsonHeaders()),
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unknown_email_returns_401() {
        var resp = rest.exchange("/api/admin/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("ghost@drshoes.pl", "any"),
                             jsonHeaders()),
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void me_without_session_returns_401() {
        var resp = rest.getForEntity("/api/admin/auth/me", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpHeaders jsonHeaders() {
        var h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }
}
