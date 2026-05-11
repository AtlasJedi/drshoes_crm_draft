package com.drshoes.lib.whatsapp;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("drshoes.whatsapp")
public class WhatsAppGatewayProperties {

    public enum Provider { WHATSAPP_CLOUD_API, NOOP }

    private Provider provider = Provider.NOOP;
    private String senderPhoneNumberId = "";

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }
    public String getSenderPhoneNumberId() { return senderPhoneNumberId; }
    public void setSenderPhoneNumberId(String id) { this.senderPhoneNumberId = id; }
}
