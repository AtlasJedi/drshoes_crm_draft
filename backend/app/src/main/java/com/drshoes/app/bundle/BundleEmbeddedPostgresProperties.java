package com.drshoes.app.bundle;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "drshoes.embedded-postgres")
public record BundleEmbeddedPostgresProperties(
    String dataDir,
    int port
) {
    public BundleEmbeddedPostgresProperties {
        if (dataDir == null || dataDir.isBlank()) {
            dataDir = System.getProperty("user.dir") + "/data/pg";
        }
        // port=0 → auto-pick free port
    }
}
