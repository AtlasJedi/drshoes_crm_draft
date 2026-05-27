package com.drshoes.lib.sms.smsapi;

import com.drshoes.lib.sms.SmsGatewayAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
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
