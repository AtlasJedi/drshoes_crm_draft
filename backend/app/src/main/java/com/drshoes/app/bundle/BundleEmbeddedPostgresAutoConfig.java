package com.drshoes.app.bundle;

import jakarta.annotation.PreDestroy;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigureBefore;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
@Profile("bundle")
@ConditionalOnClass(name = "io.zonky.test.db.postgres.embedded.EmbeddedPostgres")
@AutoConfigureBefore(DataSourceAutoConfiguration.class)
@EnableConfigurationProperties(BundleEmbeddedPostgresProperties.class)
public class BundleEmbeddedPostgresAutoConfig {

    private static final Logger log = LoggerFactory.getLogger(BundleEmbeddedPostgresAutoConfig.class);

    private Object pg; // typed as Object to avoid compile-time dependency on Zonky class

    @Bean
    public DataSource bundleEmbeddedDataSource(BundleEmbeddedPostgresProperties props) throws Exception {
        Path dataDir = Path.of(props.dataDir());
        Files.createDirectories(dataDir);
        log.info("bundle.embedded-postgres.start dataDir={} port={}", dataDir, props.port());

        Class<?> epClass = Class.forName("io.zonky.test.db.postgres.embedded.EmbeddedPostgres");
        Class<?> builderClass = Class.forName("io.zonky.test.db.postgres.embedded.EmbeddedPostgres$Builder");

        // EmbeddedPostgres.builder().setDataDirectory(dir).setCleanDataDirectory(false).setPort(port).start()
        Object builder = epClass.getMethod("builder").invoke(null);
        builder = builderClass.getMethod("setDataDirectory", java.io.File.class)
            .invoke(builder, dataDir.toFile());
        builder = builderClass.getMethod("setCleanDataDirectory", boolean.class)
            .invoke(builder, false);
        builder = builderClass.getMethod("setPort", int.class)
            .invoke(builder, props.port());
        this.pg = builderClass.getMethod("start").invoke(builder);

        String jdbcUrl = (String) epClass.getMethod("getJdbcUrl", String.class, String.class)
            .invoke(this.pg, "postgres", "postgres");
        log.info("bundle.embedded-postgres.started jdbc={}", jdbcUrl);

        return (DataSource) epClass.getMethod("getPostgresDatabase").invoke(this.pg);
    }

    @PreDestroy
    public void stop() throws Exception {
        if (pg != null) {
            log.info("bundle.embedded-postgres.stop");
            ((AutoCloseable) pg).close();
        }
    }
}
