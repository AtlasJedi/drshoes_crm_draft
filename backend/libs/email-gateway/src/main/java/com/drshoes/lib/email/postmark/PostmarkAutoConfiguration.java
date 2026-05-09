package com.drshoes.lib.email.postmark;

import com.drshoes.lib.email.EmailGatewayAutoConfiguration;
import com.drshoes.lib.storage.BlobStorage;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Auto-configures {@link PostmarkEmailGateway} when
 * {@code messaging.email.provider=postmark} is set.
 *
 * The existing {@link EmailGatewayAutoConfiguration} retains its
 * {@code @ConditionalOnMissingBean(EmailGateway.class)} guard, so
 * {@link com.drshoes.lib.email.LoggingEmailGateway} remains the fallback in
 * dev/test/local where this auto-configuration is not activated. The
 * {@code before = EmailGatewayAutoConfiguration.class} ordering ensures the
 * Postmark bean is registered first, so the missing-bean guard sees it and
 * skips the Logging fallback even when the legacy {@code drshoes.email.provider}
 * default would otherwise also produce a Logging bean.
 */
@AutoConfiguration(before = EmailGatewayAutoConfiguration.class)
@ConditionalOnProperty(name = "messaging.email.provider", havingValue = "postmark")
@EnableConfigurationProperties(PostmarkProperties.class)
public class PostmarkAutoConfiguration {

    @Bean
    public RestClient postmarkRestClient(PostmarkProperties props) {
        var factory = new SimpleClientHttpRequestFactory();
        int ms = props.getTimeoutSeconds() * 1000;
        factory.setConnectTimeout(ms);
        factory.setReadTimeout(ms);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(props.getApiBaseUrl())
                .build();
    }

    @Bean
    public PostmarkEmailGateway postmarkEmailGateway(
            RestClient postmarkRestClient,
            PostmarkProperties props,
            BlobStorage blobStorage) {
        return new PostmarkEmailGateway(postmarkRestClient, props, blobStorage);
    }
}
