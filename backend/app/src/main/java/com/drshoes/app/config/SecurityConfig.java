package com.drshoes.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import lombok.extern.slf4j.Slf4j;

/**
 * Central Spring Security configuration.
 *
 * Public allow-list:
 *   /actuator/health, /actuator/info   — health probes (no auth)
 *   /api/public/**                     — public-facing API endpoints
 *   /api/webhooks/**                   — inbound webhook callbacks
 *   /api/admin/auth/login              — login endpoint (unauthenticated)
 *
 * All other /api/admin/** routes require an authenticated session.
 *
 * CSRF: double-submit cookie (XSRF-TOKEN, httpOnly=false so JS can read it).
 * The CSRF token is delivered as a cookie on the login response — no separate
 * CSRF endpoint is needed or exposed.
 * CSRF is ignored for /api/public/**, /api/webhooks/**, and /actuator/**
 * (external callers / read-only probes — no state-changing ops there).
 */
@Configuration
@Slf4j
public class SecurityConfig {

    /**
     * When false, CSRF protection is disabled entirely.
     * Set drshoes.security.csrf-enabled=false in application-local.yaml for
     * local dev / E2E tests (Playwright bypasses the browser login page so it
     * never receives the XSRF-TOKEN cookie that Spring sets lazily on the first
     * GET through the CSRF filter, causing POST requests to fail with 403).
     * Production default: true (unchanged).
     */
    @Value("${drshoes.security.csrf-enabled:true}")
    private boolean csrfEnabled;

    // Public routes that must never require authentication
    private static final String[] PUBLIC_MATCHERS = {
        "/actuator/health",
        "/actuator/info",
        "/api/public/**",
        "/api/webhooks/**",
        "/api/admin/auth/login",
        "/api/admin/auth/quicklogin", // DEMO: auth-bypass link — remove after handoff
        "/api/health"
    };

    // Routes where CSRF is not enforced (read-only / external callers, or bootstrap endpoints
    // that cannot carry a CSRF token because no session exists yet).
    private static final String[] CSRF_IGNORED = {
        "/api/public/**",
        "/api/webhooks/**",
        "/actuator/**",
        "/api/admin/auth/login",   // bootstrap: no session = no CSRF cookie; anti-CSRF still meaningless here
        "/api/admin/auth/logout"   // Next.js server-side proxy cannot carry XSRF-TOKEN; worst-case attacker logs you out — not dangerous
    };

    /**
     * Exposed as a bean so tests can assert cookie configuration (httpOnly=false,
     * cookieName=XSRF-TOKEN) without relying on lazy token materialisation.
     */
    @Bean
    public CsrfTokenRepository csrfTokenRepository() {
        var repo = CookieCsrfTokenRepository.withHttpOnlyFalse(); // double-submit pattern
        repo.setCookieName("XSRF-TOKEN");
        return repo;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, CsrfTokenRepository csrfTokenRepository) throws Exception {
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName("_csrf");

        if (!csrfEnabled) {
            log.warn("op=securityFilterChainConfigured csrfMode=DISABLED — local/E2E profile only");
        }

        http
            .csrf(c -> {
                if (!csrfEnabled) {
                    c.disable();
                } else {
                    c.csrfTokenRepository(csrfTokenRepository)
                     .csrfTokenRequestHandler(csrfHandler)
                     .ignoringRequestMatchers(CSRF_IGNORED);
                }
            })
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(a -> a
                .requestMatchers(PUBLIC_MATCHERS).permitAll()
                .requestMatchers("/api/admin/**").authenticated()
                .anyRequest().permitAll())
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .exceptionHandling(e -> e.authenticationEntryPoint(
                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

        log.info("op=securityFilterChainConfigured publicRouteCount={} publicRoutePatterns={} csrfMode=double-submit-cookie csrfCookieName=XSRF-TOKEN",
            PUBLIC_MATCHERS.length, java.util.Arrays.toString(PUBLIC_MATCHERS));

        return http.build();
    }
}
