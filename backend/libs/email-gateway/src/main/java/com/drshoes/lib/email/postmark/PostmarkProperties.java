package com.drshoes.lib.email.postmark;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for the Postmark email gateway.
 * Activated by: messaging.email.provider=postmark
 */
@ConfigurationProperties("messaging.email.postmark")
public class PostmarkProperties {

    /** Postmark server API token (required). */
    private String serverToken;

    /** Sender address, e.g. "noreply@drshoes.pl". */
    private String from = "noreply@drshoes.pl";

    /** Postmark message stream, e.g. "outbound". */
    private String messageStream = "outbound";

    /** Basic-auth username sent by Postmark on webhook callbacks. */
    private String webhookUsername = "drshoes";

    /** Basic-auth password (webhook secret). */
    private String webhookSecret;

    /** Base URL for Postmark API, overridable for testing. */
    private String apiBaseUrl = "https://api.postmarkapp.com";

    /** HTTP read/connect timeout in seconds. */
    private int timeoutSeconds = 10;

    // Getters and setters

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
