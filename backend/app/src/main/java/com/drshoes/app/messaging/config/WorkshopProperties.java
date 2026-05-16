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
    private String address     = "ul. Mostowa 5a, 61-854 Poznań";
    private String openingHours = "pon–pt 10:00–18:00 · sob 11:00–15:00";
    private String url          = "https://drshoes.pl";
    private String phone        = "+48 514 296 809";
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

    public String getEmail()        { return email; }
    public void setEmail(String v)  { this.email = v; }
}
