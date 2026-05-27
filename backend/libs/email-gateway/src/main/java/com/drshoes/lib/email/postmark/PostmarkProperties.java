package com.drshoes.lib.email.postmark;

import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties("messaging.email.postmark")
public class PostmarkProperties {
    private String serverToken;
    private String from = "noreply@drshoes.pl";
    private String messageStream = "outbound";
    private String webhookUsername = "drshoes";
    private String webhookSecret;
    private String apiBaseUrl = "https://api.postmarkapp.com";
    private int timeoutSeconds = 10;

    public String getServerToken() { return serverToken; }
    public void setServerToken(String serverToken) { this.serverToken = serverToken; }

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }

    public String getMessageStream() { return messageStream; }
    public void setMessageStream(String messageStream) { this.messageStream = messageStream; }

    public String getWebhookUsername() { return webhookUsername; }
    public void setWebhookUsername(String webhookUsername) { this.webhookUsername = webhookUsername; }

    public String getWebhookSecret() { return webhookSecret; }
    public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
}
