package com.drshoes.lib.sms;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SmsGatewayProperties.class)
public class SmsGatewayAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(SmsGateway.class)
    @ConditionalOnProperty(prefix = "drshoes.sms", name = "provider",
                           havingValue = "NOOP", matchIfMissing = true)
    public SmsGateway loggingSmsGateway() {
        return new LoggingSmsGateway();
    }
}
