package com.drshoes.app.messaging.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import lombok.Getter;
import lombok.Setter;
@ConfigurationProperties("drshoes.workshop")
@Getter
@Setter
public class WorkshopProperties {

    private String name        = "Dr Shoes Poznań";
    private String address     = "Aleje Karola Marcinkowskiego 26, 61-745 Poznań";
    private String openingHours = "pon–pt 10:00–18:00 · sob 11:00–15:00";
    private String url          = "https://drshoes.pl";
    private String phone        = "+48 514 296 809";
    private String phoneLink    = "tel:+48514296809";
    private String mapsUrl      = "https://www.google.com/maps/dir/?api=1&destination=Aleje%20Karola%20Marcinkowskiego%2026%2C%2061-745%20Pozna%C5%84";
    private String email        = "kontakt@drshoes.pl";
    public void setAddress(String v){ this.address = v; }
    public void setUrl(String v)    { this.url = v; }
    public void setPhoneLink(String v)   { this.phoneLink = v; }
    public void setEmail(String v)  { this.email = v; }
}
