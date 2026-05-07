package com.drshoes.app.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * Central Spring Security configuration.
 *
 * Public allow-list:
 *   /actuator/health, /actuator/info   — health probes (no auth)
 *   /api/public/**                     — public-facing API endpoints
 *   /api/webhooks/**                   — inbound webhook callbacks
 *   /api/admin/auth/login              — login endpoint (unauthenticated)
 *   /api/admin/auth/csrf               — CSRF token fetch (unauthenticated)
 *
 * All other /api/admin/** routes require an authenticated session.
 *
 * CSRF: double-submit cookie (XSRF-TOKEN, httpOnly=false so JS can read it).
 * CSRF is ignored for public/** and actuator/** routes (no state-changing ops there).
 */
@Configuration
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    // Public routes that must never require authentication
    private static final String[] PUBLIC_MATCHERS = {
        "/actuator/health",
        "/actuator/info",
        "/api/public/**",
        "/api/webhooks/**",
        "/api/admin/auth/login",
        "/api/admin/auth/csrf"
    };

    // Routes where CSRF is not enforced (read-only / external callers)
    private static final String[] CSRF_IGNORED = {
        "/api/public/**",
        "/api/webhooks/**",
        "/actuator/**"
    };

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        var csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse(); // double-submit pattern
        csrfRepo.setCookieName("XSRF-TOKEN");

        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName("_csrf");

        http
            .csrf(c -> c
                .csrfTokenRepository(csrfRepo)
                .csrfTokenRequestHandler(csrfHandler)
                .ignoringRequestMatchers(CSRF_IGNORED))
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

        log.info("op=securityFilterChainConfigured publicRoutes={} csrfMode=double-submit-cookie csrfCookieName=XSRF-TOKEN",
            PUBLIC_MATCHERS.length);

        return http.build();
    }
}
