package com.drshoes.lib.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import lombok.Getter;
import lombok.Setter;

@ConfigurationProperties("drshoes.storage")
@Getter
@Setter
public class StorageProperties {
    private String endpoint = "http://localhost:9000";
    private String region = "us-east-1";
    private String bucket = "drshoes-dev";
    private String accessKey = "drshoes";
    private String secretKey = "drshoes-dev-secret";
    private boolean pathStyleAccess = true;
    public void setRegion(String region) { this.region = region; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
}
