package com.drshoes.app.client;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.client.dto.ClientDto;
import com.drshoes.app.client.dto.ClientSearchResult;
import com.drshoes.app.client.dto.CreateClientRequest;
import com.drshoes.app.client.dto.UpdateClientRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Business logic for the Client aggregate.
 *
 * Structured logging per dispatch-protocol §7:
 *   op=<name> clientId={} outcome=ok|already-deleted|not-found
 * The client_contact_present invariant (phone OR email required) is validated here
 * before any DB write, so callers receive a domain exception rather than a raw
 * DataIntegrityViolationException from the CHECK constraint.
 */
@Service
public class ClientService {

    private static final Logger log = LoggerFactory.getLogger(ClientService.class);
    private static final int SEARCH_MAX = 20;
    private static final java.util.Set<String> VALID_CHANNELS =
        java.util.Set.of("EMAIL", "SMS", "WHATSAPP");

    private final ClientRepository repo;

    public ClientService(ClientRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public ClientDto create(CreateClientRequest req) {
        validateContactPresent(req.phone(), req.email());
        Client c = new Client();
        c.setFirstName(req.firstName().trim());
        if (req.lastName() != null) c.setLastName(req.lastName().trim());
        c.setPhone(req.phone());
        c.setEmail(req.email());
        c.setNotes(req.notes());
        if (Boolean.TRUE.equals(req.rodoConsent())) c.setRodoConsentAt(Instant.now());
        Client saved = repo.save(c);
        log.info("op=createClient clientId={} rodoConsent={} outcome=ok", saved.getId(), req.rodoConsent());
        return ClientDto.of(saved);
    }

    @Transactional(readOnly = true)
    public Page<ClientDto> list(Pageable pageable) {
        return repo.findAllByDeletedAtIsNull(pageable).map(ClientDto::of);
    }

    @Transactional(readOnly = true)
    public ClientDto get(UUID id) {
        return repo.findById(id)
            .filter(c -> c.getDeletedAt() == null)
            .map(ClientDto::of)
            .orElseThrow(() -> new ClientNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public List<ClientSearchResult> search(String q) {
        String trimmed = q == null ? "" : q.trim();
        if (trimmed.isEmpty()) return List.of();
        List<ClientSearchResult> results = repo.searchTopN(trimmed, PageRequest.of(0, SEARCH_MAX))
            .stream().map(ClientSearchResult::of).toList();
        log.info("op=searchClients q.length={} hits={} outcome=ok", trimmed.length(), results.size());
        return results;
    }

    @Transactional
    public ClientDto update(UUID id, UpdateClientRequest req) {
        Client c = repo.findById(id)
            .filter(x -> x.getDeletedAt() == null)
            .orElseThrow(() -> new ClientNotFoundException(id));
        if (req.firstName() != null) c.setFirstName(req.firstName().trim());
        if (req.lastName()  != null) c.setLastName(req.lastName().trim());
        String newPhone = req.phone() != null ? req.phone() : c.getPhone();
        String newEmail = req.email() != null ? req.email() : c.getEmail();
        validateContactPresent(newPhone, newEmail);
        if (req.phone() != null) c.setPhone(req.phone());
        if (req.email() != null) c.setEmail(req.email());
        if (req.notes() != null) c.setNotes(req.notes());
        if (req.preferredChannel() != null) {
            if (!VALID_CHANNELS.contains(req.preferredChannel())) {
                throw new IllegalArgumentException(
                    "Invalid preferredChannel: " + req.preferredChannel()
                    + ". Must be one of " + VALID_CHANNELS);
            }
            c.setPreferredChannel(req.preferredChannel());
        }
        boolean rodoChanged = req.rodoConsent() != null;
        if (Boolean.TRUE.equals(req.rodoConsent()))  c.setRodoConsentAt(Instant.now());
        if (Boolean.FALSE.equals(req.rodoConsent())) c.setRodoConsentAt(null);
        log.info("op=updateClient clientId={} rodoChanged={} outcome=ok", id, rodoChanged);
        return ClientDto.of(repo.save(c));
    }

    @Transactional
    public void softDelete(UUID id) {
        Client c = repo.findById(id)
            .orElseThrow(() -> new ClientNotFoundException(id));
        if (c.getDeletedAt() != null) {
            log.info("op=softDeleteClient clientId={} outcome=already-deleted", id);
            return;
        }
        c.setDeletedAt(Instant.now());
        repo.save(c);
        log.info("op=softDeleteClient clientId={} outcome=ok", id);
    }

    // ------------------------------------------------------------------ helpers

    private static void validateContactPresent(String phone, String email) {
        boolean hasPhone = phone != null && !phone.isBlank();
        boolean hasEmail = email != null && !email.isBlank();
        if (!hasPhone && !hasEmail) {
            throw new ClientContactMissingException();
        }
    }
}
