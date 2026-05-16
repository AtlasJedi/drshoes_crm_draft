package com.drshoes.lib.email.smtp;

import com.drshoes.lib.email.EmailGatewayAutoConfiguration;
import com.drshoes.lib.storage.BlobStorage;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Activates the SMTP-backed EmailGateway when
 * {@code messaging.email.provider=smtp} is set.
 *
 * Spring Boot's MailSenderAutoConfiguration supplies the JavaMailSender bean
 * from {@code spring.mail.*} properties — host, port, username, password,
 * starttls, ssl, etc. This config only wires that sender into our gateway.
 *
 * Ordered before EmailGatewayAutoConfiguration so the @ConditionalOnMissingBean
 * fallback to LoggingEmailGateway is skipped when SMTP is active.
 */
@AutoConfiguration(before = EmailGatewayAutoConfiguration.class)
@ConditionalOnProperty(name = "messaging.email.provider", havingValue = "smtp")
@EnableConfigurationProperties(SmtpProperties.class)
public class SmtpAutoConfiguration {

    @Bean
    public SmtpEmailGateway smtpEmailGateway(JavaMailSender mailSender,
                                             SmtpProperties props,
                                             BlobStorage blobStorage) {
        return new SmtpEmailGateway(mailSender, props, blobStorage);
    }
}
