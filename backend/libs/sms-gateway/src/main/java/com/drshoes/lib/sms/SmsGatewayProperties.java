package com.drshoes.lib.sms;

import org.springframework.boot.context.properties.ConfigurationProperties;
import lombok.Getter;
import lombok.Setter;

@ConfigurationProperties("drshoes.sms")
@Getter
@Setter
public final class SmsGatewayProperties {

    public enum Provider { SMSAPI_PL, TWILIO, NOOP }

    private Provider provider = Provider.NOOP;
    private String senderName = "DrShoes";
    public void setSenderName(String senderName) { this.senderName = senderName; }
}
