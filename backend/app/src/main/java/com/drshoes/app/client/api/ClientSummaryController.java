package com.drshoes.app.client.api;

import com.drshoes.app.client.ClientSummaryService;
import com.drshoes.app.client.dto.ClientSummaryDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Provides the aggregate summary KPI tile data for a single client dossier.
 *
 * Endpoint:
 *   GET /api/admin/clients/{id}/summary — returns ClientSummaryDto (OWNER | EMPLOYEE)
 *
 * Structured logging per dispatch-protocol §7:
 *   op=getClientSummary actor={} clientId={} outcome=ok|not-found
 *
 * 404 is thrown by ClientSummaryService via ClientNotFoundException, mapped by
 * the existing ClientExceptionHandler.
 */
@RestController
@RequestMapping("/api/admin/clients")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
public class ClientSummaryController {

    private static final Logger log = LoggerFactory.getLogger(ClientSummaryController.class);

    private final ClientSummaryService svc;

    public ClientSummaryController(ClientSummaryService svc) {
        this.svc = svc;
    }

    @GetMapping("/{id}/summary")
    public ClientSummaryDto getSummary(@PathVariable UUID id, Authentication auth) {
        log.info("op=getClientSummary actor={} clientId={}", actor(auth), id);
        ClientSummaryDto dto = svc.getSummary(id);
        log.info("op=getClientSummary actor={} clientId={} outcome=ok", actor(auth), id);
        return dto;
    }

    private static String actor(Authentication auth) {
        return (auth != null) ? auth.getName() : "anonymous";
    }
}
