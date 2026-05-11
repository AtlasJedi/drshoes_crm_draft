package com.drshoes.app.demo;

import com.drshoes.app.AbstractIntegrationTest;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test: verifies DemoThreadFactory seeds one thread with
 * 4 alternating-direction EMAIL messages, and that a second seed run
 * does not create duplicate threads or messages (idempotency).
 *
 * @ActiveProfiles must include "local" to activate @Profile("local") demo beans.
 * @TestPropertySource enables the @ConditionalOnProperty guard on DemoSeedRunner.
 * Testcontainers Postgres wired via AbstractIntegrationTest.
 */
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "drshoes.demo.seed.enabled=true")
class DemoSeedThreadIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MessageThreadRepository threads;
    @Autowired private MessageRepository messages;
    @Autowired private DemoSeedRunner runner;

    @Test
    void seedCreatesSampleThread() {
        // At least one thread must exist after seed
        assertThat(threads.count()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void sampleThreadHasFourMessages() {
        var allThreads = threads.findAll();
        assertThat(allThreads).isNotEmpty();
        var thread = allThreads.get(0);
        List<MessageEntity> msgs = messages.findAllByThreadIdOrderByCreatedAtAsc(thread.getId());
        assertThat(msgs).hasSize(4);
    }

    @Test
    void messagesAlternateDirection() {
        var thread = threads.findAll().get(0);
        var dirs = messages.findAllByThreadIdOrderByCreatedAtAsc(thread.getId())
            .stream().map(MessageEntity::getDirection).toList();
        assertThat(dirs).containsExactly("OUTBOUND", "INBOUND", "OUTBOUND", "INBOUND");
    }

    @Test
    void seedIsIdempotentForThreadsAndMessages() {
        long beforeThreads  = threads.count();
        long beforeMessages = messages.count();
        runner.run();
        assertThat(threads.count()).isEqualTo(beforeThreads);
        assertThat(messages.count()).isEqualTo(beforeMessages);
    }
}
