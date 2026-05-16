package com.drshoes.lib.email.smtp;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("messaging.email.smtp")
public class SmtpProperties {

    private String from = "no-reply@drshoes.local";
    private String fromName = "Dr Shoes";

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }

    public String getFromName() { return fromName; }
    public void setFromName(String fromName) { this.fromName = fromName; }
}
