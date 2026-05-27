package com.drshoes.app.messaging.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;
@Configuration
public class MessagingClockConfig {

    @Bean
    public Clock messagingClock() {
        return Clock.system(ZoneId.of("Europe/Warsaw"));
    }
}
