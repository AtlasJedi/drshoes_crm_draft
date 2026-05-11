package com.drshoes.lib.whatsapp;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@EnableConfigurationProperties(WhatsAppGatewayProperties.class)
public class WhatsAppGatewayAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(WhatsAppGateway.class)
    @ConditionalOnProperty(prefix = "drshoes.whatsapp", name = "provider",
                           havingValue = "NOOP", matchIfMissing = true)
    public WhatsAppGateway loggingWhatsAppGateway() {
        return new LoggingWhatsAppGateway();
    }
}
