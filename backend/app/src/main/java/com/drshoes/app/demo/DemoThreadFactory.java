package com.drshoes.app.demo;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.order.domain.Order;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Stub — replaced by full implementation in task 8-10. */
@Component
@Profile("local")
public class DemoThreadFactory {
    public void createSampleThread(Client client, Order order) {
        // no-op stub
    }
}
