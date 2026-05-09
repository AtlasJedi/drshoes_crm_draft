package com.drshoes.lib.sms.smsapi;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Auto-configures {@link SmsApiSmsGateway} when
 * {@code messaging.sms.provider=smsapi} is set.
 *
 * The existing {@link com.drshoes.lib.sms.SmsGatewayAutoConfiguration} retains
 * its {@code @ConditionalOnMissingBean(SmsGateway.class)} guard, so
 * {@link com.drshoes.lib.sms.LoggingSmsGateway} remains the fallback in
 * dev/test/local where this auto-configuration is not activated.
 */
@AutoConfiguration
@ConditionalOnProperty(name = "messaging.sms.provider", havingValue = "smsapi")
@EnableConfigurationProperties(SmsApiProperties.class)
public class SmsApiAutoConfiguration {

    @Bean
    public RestClient smsApiRestClient(SmsApiProperties props) {
        int ms = props.getTimeoutSeconds() * 1000;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(ms);
        factory.setReadTimeout(ms);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(props.getApiBaseUrl())
                .build();
    }

    @Bean
    @ConditionalOnProperty(name = "messaging.sms.provider", havingValue = "smsapi")
    public SmsApiSmsGateway smsApiSmsGateway(RestClient smsApiRestClient,
                                              SmsApiProperties props) {
        return new SmsApiSmsGateway(smsApiRestClient, props);
    }
}
