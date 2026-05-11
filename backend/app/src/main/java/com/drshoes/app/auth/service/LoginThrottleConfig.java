package com.drshoes.app.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Registers the LoginThrottle bean.
 *
 * Production: 5 attempts per 15-minute window (interval refill).
 * Local/E2E: configurable via drshoes.auth.throttle.capacity (default 1000)
 * and drshoes.auth.throttle.window-minutes (default 1) so E2E test suites
 * don't exhaust the bucket across retries.
 */
@Configuration
public class LoginThrottleConfig {

    @Value("${drshoes.auth.throttle.capacity:5}")
    private long capacity;

    @Value("${drshoes.auth.throttle.window-minutes:15}")
    private int windowMinutes;

    @Bean
    LoginThrottle loginThrottle() {
        return new LoginThrottle(capacity, Duration.ofMinutes(windowMinutes));
    }
}
