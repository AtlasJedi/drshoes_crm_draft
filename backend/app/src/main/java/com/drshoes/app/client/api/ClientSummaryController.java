package com.drshoes.app.client.api;

import com.drshoes.app.client.ClientSummaryService;
import com.drshoes.app.client.dto.ClientSummaryDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/clients")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
@Slf4j
@RequiredArgsConstructor
public class ClientSummaryController {

    private final ClientSummaryService svc;

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
