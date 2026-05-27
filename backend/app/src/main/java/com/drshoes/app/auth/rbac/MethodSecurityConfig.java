package com.drshoes.app.auth.rbac;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity(prePostEnabled = true)
public final class MethodSecurityConfig {}
