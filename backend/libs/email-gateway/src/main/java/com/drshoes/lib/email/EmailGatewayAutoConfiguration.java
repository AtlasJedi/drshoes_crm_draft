package com.drshoes.lib.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.autoconfigure.AutoConfiguration;

@AutoConfiguration
@EnableConfigurationProperties(EmailGatewayProperties.class)
public class EmailGatewayAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(EmailGateway.class)
    @ConditionalOnProperty(prefix = "drshoes.email", name = "provider",
                           havingValue = "NOOP", matchIfMissing = true)
    public EmailGateway loggingEmailGateway() {
        return new LoggingEmailGateway();
    }
}
