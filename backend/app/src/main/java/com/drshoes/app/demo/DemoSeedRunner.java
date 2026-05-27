package com.drshoes.app.demo;

import com.drshoes.app.client.domain.ClientRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Component("demoSeedRunner")
@Profile("local")
@ConditionalOnProperty(prefix = "drshoes.demo.seed", name = "enabled",
    havingValue = "true", matchIfMissing = false)
@Slf4j
@RequiredArgsConstructor
public class DemoSeedRunner implements ApplicationRunner {
    private static final int SEED_THRESHOLD = 6;

    private final ClientRepository clientRepository;
    private final DemoClientFactory clientFactory;
    private final DemoOrderFactory orderFactory;
    private final DemoThreadFactory threadFactory;

    @Override
    public void run(ApplicationArguments args) {
        run();
    }
    void run() {
        log.info("op=demo.seed status=starting");
        long existing = clientRepository.count();
        if (existing >= SEED_THRESHOLD) {
            log.info("op=demo.seed status=skipped reason=already-seeded existingClients={}", existing);
            return;
        }
        var clients = clientFactory.createAll();
        log.info("op=demo.seed clients.created={}", clients.size());
        var orders = orderFactory.createAll(clients);
        log.info("op=demo.seed orders.created={}", orders.size());
        if (!clients.isEmpty() && !orders.isEmpty()) {
            threadFactory.createSampleThread(clients.get(0), orders.get(0));
        }
        log.info("op=demo.seed status=done");
    }
}
