package com.drshoes.app.auth.service;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Registers the production LoginThrottle bean.
 * Capacity: 5 attempts; window: 15 minutes (interval refill).
 */
@Configuration
public class LoginThrottleConfig {

    @Bean
    LoginThrottle loginThrottle() {
        return new LoginThrottle(5, Duration.ofMinutes(15));
    }
}
