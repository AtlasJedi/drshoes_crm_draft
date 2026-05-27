package com.drshoes.lib.sms.smsapi;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.util.List;
@ConfigurationProperties("messaging.sms.smsapi")
public final class SmsApiProperties {
    private String token;
    private String from = "DrShoes";
    private List<String> callbackAllowlist = List.of(
            "89.174.81.98",
            "91.185.187.219",
            "213.189.53.211",
            "31.186.83.18",
            "212.91.26.253"
    );
    private String clientIpHeader = "X-Forwarded-For";
    private String apiBaseUrl = "https://api.smsapi.pl";
    private int timeoutSeconds = 10;

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
