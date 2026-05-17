package com.drshoes.app.messaging.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Workshop-level constants bound from {@code drshoes.workshop.*} config.
 * Values default to Dr Shoes Poznań contact details; override via environment
 * or application.yaml for other tenants / deployments.
 */
@ConfigurationProperties("drshoes.workshop")
public class WorkshopProperties {

    private String name        = "Dr Shoes Poznań";
    private String address     = "Aleje Karola Marcinkowskiego 26, 61-745 Poznań";
    private String openingHours = "pon–pt 10:00–18:00 · sob 11:00–15:00";
    private String url          = "https://drshoes.pl";
    private String phone        = "+48 514 296 809";
    private String phoneLink    = "tel:+48514296809";
    private String mapsUrl      = "https://www.google.com/maps/dir/?api=1&destination=Aleje%20Karola%20Marcinkowskiego%2026%2C%2061-745%20Pozna%C5%84";
    private String email        = "kontakt@drshoes.pl";

    public String getName()         { return name; }
    public void setName(String v)   { this.name = v; }

    public String getAddress()      { return address; }
    public void setAddress(String v){ this.address = v; }

    public String getOpeningHours()        { return openingHours; }
    public void setOpeningHours(String v)  { this.openingHours = v; }

    public String getUrl()          { return url; }
    public void setUrl(String v)    { this.url = v; }

    public String getPhone()        { return phone; }
    public void setPhone(String v)  { this.phone = v; }

    public String getPhoneLink()         { return phoneLink; }
    public void setPhoneLink(String v)   { this.phoneLink = v; }

    public String getMapsUrl()       { return mapsUrl; }
    public void setMapsUrl(String v) { this.mapsUrl = v; }

    public String getEmail()        { return email; }
    public void setEmail(String v)  { this.email = v; }
}
