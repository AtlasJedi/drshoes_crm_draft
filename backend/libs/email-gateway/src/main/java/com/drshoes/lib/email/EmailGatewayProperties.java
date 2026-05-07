package com.drshoes.lib.email;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("drshoes.email")
public class EmailGatewayProperties {

    public enum Provider { POSTMARK, SMTP, NOOP }

    private Provider provider = Provider.NOOP;
    private String from = "no-reply@drshoes.pl";

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }
    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }
}
