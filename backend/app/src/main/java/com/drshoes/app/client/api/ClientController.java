package com.drshoes.app.client.api;

import com.drshoes.app.client.ClientService;
import com.drshoes.app.client.dto.ClientDto;
import com.drshoes.app.client.dto.ClientSearchResult;
import com.drshoes.app.client.dto.CreateClientRequest;
import com.drshoes.app.client.dto.UpdateClientRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for the Client aggregate.
 *
 * Endpoints:
 *   GET    /api/admin/clients            — paginated list (OWNER | EMPLOYEE)
 *   GET    /api/admin/clients/search?q=  — typeahead search top-N (OWNER | EMPLOYEE)
 *   GET    /api/admin/clients/{id}       — single client (OWNER | EMPLOYEE)
 *   POST   /api/admin/clients            — create (OWNER | EMPLOYEE)
 *   PATCH  /api/admin/clients/{id}       — update (OWNER | EMPLOYEE)
 *   DELETE /api/admin/clients/{id}       — soft-delete (OWNER only)
 *
 * Structured logging per dispatch-protocol §7:
 *   op=<method> actor={} clientId={} outcome=ok|not-found
 *
 * RBAC: every endpoint requires an authenticated session (enforced by SecurityConfig).
 * DELETE is further restricted to OWNER via @PreAuthorize + RbacService.canManageClients.
 */
@RestController
@RequestMapping("/api/admin/clients")
public class ClientController {

    private static final Logger log = LoggerFactory.getLogger(ClientController.class);

    private final ClientService svc;

    public ClientController(ClientService svc) {
        this.svc = svc;
    }

    @GetMapping
    public Page<ClientDto> list(Pageable pageable, Authentication auth) {
        log.info("op=listClients actor={} outcome=ok", actor(auth));
        return svc.list(pageable);
    }

    @GetMapping("/search")
    public List<ClientSearchResult> search(@RequestParam("q") String q, Authentication auth) {
        log.info("op=searchClients actor={} q.length={} outcome=ok", actor(auth), q == null ? 0 : q.length());
        return svc.search(q);
    }

    @GetMapping("/{id}")
    public ClientDto get(@PathVariable UUID id, Authentication auth) {
        ClientDto dto = svc.get(id);
        log.info("op=getClient actor={} clientId={} outcome=ok", actor(auth), id);
        return dto;
    }

    @PostMapping
    public ResponseEntity<ClientDto> create(@Valid @RequestBody CreateClientRequest req,
                                            Authentication auth) {
        ClientDto created = svc.create(req);
        log.info("op=createClient actor={} clientId={} outcome=ok", actor(auth), created.id());
        return ResponseEntity
            .created(URI.create("/api/admin/clients/" + created.id()))
            .body(created);
    }

    @PatchMapping("/{id}")
    public ClientDto update(@PathVariable UUID id,
                            @Valid @RequestBody UpdateClientRequest req,
                            Authentication auth) {
        ClientDto updated = svc.update(id, req);
        log.info("op=updateClient actor={} clientId={} outcome=ok", actor(auth), id);
        return updated;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@rbac.canManageClients(authentication)")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        svc.softDelete(id);
        log.info("op=deleteClient actor={} clientId={} outcome=ok", actor(auth), id);
        return ResponseEntity.noContent().build();
    }

    private static String actor(Authentication auth) {
        return (auth != null) ? auth.getName() : "anonymous";
    }
}
