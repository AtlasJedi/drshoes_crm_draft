package com.drshoes.app.auth.service;

import com.drshoes.app.auth.domain.User;
import com.drshoes.app.auth.domain.UserRepository;
import com.drshoes.app.auth.principal.AdminPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder enc;
    private final LoginThrottle throttle;
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
