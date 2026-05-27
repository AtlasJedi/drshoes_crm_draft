package com.drshoes.app.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
@Configuration
public class LoginThrottleConfig {

    @Value("${drshoes.auth.throttle.enabled:true}")
    private boolean enabled;

    @Value("${drshoes.auth.throttle.capacity:5}")
    private long capacity;

    @Value("${drshoes.auth.throttle.window-minutes:15}")
    private int windowMinutes;

    @Bean
    LoginThrottle loginThrottle() {
        return new LoginThrottle(
                capacity,
                Duration.ofMinutes(windowMinutes),
                io.github.bucket4j.TimeMeter.SYSTEM_NANOTIME,
                enabled);
    }
}
