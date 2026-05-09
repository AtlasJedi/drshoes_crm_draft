package com.drshoes.lib.sms.smsapi;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;

/**
 * Configuration properties for the SMSAPI SMS gateway.
 * Activated by: messaging.sms.provider=smsapi
 * Prefix: messaging.sms.smsapi
 */
@ConfigurationProperties("messaging.sms.smsapi")
public class SmsApiProperties {

    /** SMSAPI OAuth2 token (required). */
    private String token;

    /** Sender name or number registered in the SMSAPI account, e.g. "DrShoes". */
    private String from = "DrShoes";

    /**
     * List of allowed source IPs for SMSAPI webhook callbacks.
     * Used by the webhook controller (task 4-10), NOT by this gateway.
     * Defaults to the SMSAPI documented IP range (verified 2026-05-09).
     */
    private List<String> callbackAllowlist = List.of(
            "89.174.81.98",
            "91.185.187.219",
            "213.189.53.211",
            "31.186.83.18",
            "212.91.26.253"
    );

    /**
     * HTTP header to read client IP from (for webhook IP allowlist check).
     * Behind Cloudflare Containers set to "Cf-Connecting-Ip".
     * Used by the webhook controller (task 4-10), NOT by this gateway.
     */
    private String clientIpHeader = "X-Forwarded-For";

    /** Base URL for SMSAPI REST API, overridable for testing. */
    private String apiBaseUrl = "https://api.smsapi.pl";

    /** HTTP read/connect timeout in seconds. */
    private int timeoutSeconds = 10;

    // ── getters and setters ─────────────────────────────────────────────────

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }

    public List<String> getCallbackAllowlist() { return callbackAllowlist; }
    public void setCallbackAllowlist(List<String> callbackAllowlist) {
        this.callbackAllowlist = callbackAllowlist;
    }

    public String getClientIpHeader() { return clientIpHeader; }
    public void setClientIpHeader(String clientIpHeader) { this.clientIpHeader = clientIpHeader; }

    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
}
