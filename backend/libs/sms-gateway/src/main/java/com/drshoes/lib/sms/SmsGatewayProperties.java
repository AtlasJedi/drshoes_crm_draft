package com.drshoes.lib.sms;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("drshoes.sms")
public class SmsGatewayProperties {

    public enum Provider { SMSAPI_PL, TWILIO, NOOP }

    private Provider provider = Provider.NOOP;
    private String senderName = "DrShoes";

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
}
