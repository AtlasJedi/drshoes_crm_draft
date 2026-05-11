package com.drshoes.app.demo;

import com.drshoes.app.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

// Need "local" profile in addition to "test" so that @Profile("local") beans are active.
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "drshoes.demo.seed.enabled=true")
class DemoSeedRunnerRegistrationTest extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext ctx;

    @Test
    void demoSeedRunnerBeanIsRegistered() {
        assertThat(ctx.containsBean("demoSeedRunner")).isTrue();
    }

    @Test
    void demoSeedRunnerRunsWithoutException() {
        DemoSeedRunner runner = ctx.getBean(DemoSeedRunner.class);
        // run() is already called by Spring Boot on startup; calling it again must be idempotent
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
            () -> runner.run()
        );
    }
}
