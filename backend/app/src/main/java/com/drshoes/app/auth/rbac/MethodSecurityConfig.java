package com.drshoes.app.auth.rbac;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

/**
 * Enables Spring Security method-level security.
 * Required for @PreAuthorize / @PostAuthorize annotations to be enforced.
 * Without this, @PreAuthorize is silently ignored.
 */
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class MethodSecurityConfig {}
