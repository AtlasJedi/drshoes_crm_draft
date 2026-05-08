package com.drshoes.app.messaging.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/**
 * Provides a Clock bean pinned to Europe/Warsaw for use in ScheduledTriggerJob.
 * Tests can override this bean via @TestConfiguration to control time.
 */
@Configuration
public class MessagingClockConfig {

    @Bean
    public Clock messagingClock() {
        return Clock.system(ZoneId.of("Europe/Warsaw"));
    }
}
