package com.drshoes.app.demo;

import com.drshoes.app.client.ClientService;
import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.CreateClientRequest;
import com.drshoes.app.client.dto.UpdateClientRequest;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@Component
@Profile("local")
@Slf4j
@RequiredArgsConstructor
public class DemoClientFactory {

    private final ClientService clientService;
    private final ClientRepository clientRepository;

    public List<Client> createAll() {
        var ids = List.of(
            create("Anna",      "Kowalska",    "+48501234567", "anna.kowalska@example.pl",  "EMAIL",    true),
            create("Marek",     "Nowak",       "+48512345678", null,                        "SMS",      true),
            create("Ewa",       "Wiśniewska",  "+48523456789", "ewa.wisniews@example.pl",   "EMAIL",    false),
            create("Tomasz",    "Wójcik",      null,           "t.wojcik@example.pl",       "WHATSAPP", true),
            create("Katarzyna", "Kowalczyk",   "+48534567890", "k.kowalczyk@example.pl",    "EMAIL",    false),
            create("Piotr",     "Zieliński",   "+48545678901", "p.zielinski@example.pl",    "SMS",      true)
        );

        return ids.stream()
            .map(id -> clientRepository.findById(id).orElseThrow())
            .toList();
    }
    private UUID create(String firstName, String lastName,
                        String phone, String email,
                        String channel, boolean rodoConsent) {
        var req = new CreateClientRequest(firstName, lastName, phone, email, null, null);
        var dto = clientService.create(req);
        clientService.update(dto.id(), new UpdateClientRequest(
            null, null, null, null,
            channel,
            rodoConsent ? Boolean.TRUE : null,
            null
        ));
        log.info("op=demo.seed.client clientId={} name={} channel={}",
            dto.id(), firstName + " " + lastName, channel);
        return dto.id();
    }
}
