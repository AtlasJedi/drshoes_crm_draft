package com.drshoes.app;

import com.drshoes.app.messaging.config.WorkshopProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(WorkshopProperties.class)
public class DrShoesApplication {
    public static void main(String[] args) {
        SpringApplication.run(DrShoesApplication.class, args);
    }
}
