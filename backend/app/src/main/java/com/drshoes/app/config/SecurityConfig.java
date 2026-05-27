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
@Configuration(proxyBeanMethods = false)
@Slf4j
public final class SecurityConfig {
    @Value("${drshoes.security.csrf-enabled:true}")
    private boolean csrfEnabled;
    private static final String[] PUBLIC_MATCHERS = {
        "/actuator/health",
        "/actuator/info",
        "/api/public/**",
        "/api/webhooks/**",
        "/api/admin/auth/login",
        "/api/admin/auth/quicklogin",
        "/api/health"
    };
    private static final String[] CSRF_IGNORED = {
        "/api/public/**",
        "/api/webhooks/**",
        "/actuator/**",
        "/api/admin/auth/login",
        "/api/admin/auth/logout"
    };
    @Bean
    public CsrfTokenRepository csrfTokenRepository() {
        var repo = CookieCsrfTokenRepository.withHttpOnlyFalse();
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
