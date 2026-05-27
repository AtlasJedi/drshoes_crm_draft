package com.drshoes.app.config;

import org.springframework.boot.web.servlet.server.CookieSameSiteSupplier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession;

@Configuration(proxyBeanMethods = false)
@EnableJdbcHttpSession(maxInactiveIntervalInSeconds = 1800)
public final class SessionConfig {

    @Bean
    CookieSameSiteSupplier sameSite() {
        return CookieSameSiteSupplier.ofLax();
    }
}
