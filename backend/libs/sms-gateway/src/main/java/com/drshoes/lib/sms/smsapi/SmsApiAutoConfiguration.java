package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.sms.SmsGatewayAutoConfiguration;
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
 * Ordered {@code before = SmsGatewayAutoConfiguration.class} so the SmsApi
 * gateway bean registers before the fallback {@link com.drshoes.lib.sms.LoggingSmsGateway}
 * autoconfig evaluates its {@code @ConditionalOnMissingBean(SmsGateway.class)}
 * guard — without this ordering both beans can register and Spring fails with
 * NoUniqueBeanDefinitionException at startup when this provider is selected.
 */
@AutoConfiguration(before = SmsGatewayAutoConfiguration.class)
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
    public SmsApiSmsGateway smsApiSmsGateway(RestClient smsApiRestClient,
                                              SmsApiProperties props) {
        return new SmsApiSmsGateway(smsApiRestClient, props);
    }
}
