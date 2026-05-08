package com.drshoes.app.auth.service;

import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.principal.AdminPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Core authentication service: throttle-check → load user → BCrypt-verify →
 * set last_login_at → push authentication into SecurityContextHolder.
 *
 * Structured logging per dispatch-protocol §7:
 *   op=login actor={email} userId={id} outcome=success|invalid_credentials|throttled ip={ip}
 * Password / hash are NEVER logged.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository users;
    private final PasswordEncoder enc;
    private final LoginThrottle throttle;

    public AuthService(UserRepository users, PasswordEncoder enc, LoginThrottle throttle) {
        this.users = users;
        this.enc = enc;
        this.throttle = throttle;
    }

    /**
     * Authenticates a user by email and password.
     * Throttle check happens BEFORE user lookup (anti-enumeration: unknown emails
     * still consume a token from the bucket, so response timing is uniform).
     *
     * @param email    the login email
     * @param password the plaintext password (never logged)
     * @param request  the current HTTP request (used for IP-based throttle key)
     * @return the authenticated User entity
     * @throws LoginThrottledException     if too many attempts from the same IP
     * @throws InvalidCredentialsException if email not found or password mismatch
     */
    @Transactional
    public User login(String email, String password, HttpServletRequest request) {
        String ip = request.getRemoteAddr();

        if (!throttle.tryConsume(ip)) {
            log.info("op=login actor={} ip={} outcome=throttled", email, ip);
            throw new LoginThrottledException();
        }

        var u = users.findActiveByEmailIgnoreCase(email)
            .orElseThrow(() -> {
                log.info("op=login actor={} ip={} outcome=invalid_credentials reason=user_not_found", email, ip);
                return new InvalidCredentialsException();
            });

        if (!enc.matches(password, u.getPasswordHash())) {
            log.info("op=login actor={} ip={} outcome=invalid_credentials reason=password_mismatch", email, ip);
            throw new InvalidCredentialsException();
        }

        u.setLastLoginAt(Instant.now());
        users.save(u);

        var principal = new AdminPrincipal(u.getId(), u.getEmail(), u.getRole().name());
        var auth = new UsernamePasswordAuthenticationToken(
            principal, null,
            List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);

        log.info("op=login actor={} userId={} ip={} outcome=success", email, u.getId(), ip);
        return u;
    }
}
