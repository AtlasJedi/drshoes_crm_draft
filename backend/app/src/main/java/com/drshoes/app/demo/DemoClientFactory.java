package com.drshoes.app.demo;

import com.drshoes.app.client.domain.Client;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/** Stub — replaced by full implementation in task 8-9. */
@Component
@Profile("local")
public class DemoClientFactory {
    public List<Client> createAll() {
        return List.of();
    }
}
