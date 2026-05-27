package com.drshoes.app.messaging.api;

import com.drshoes.app.messaging.dto.ToggleTriggerRequest;
import com.drshoes.app.messaging.dto.TriggerDto;
import com.drshoes.app.messaging.service.TriggerService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for automation trigger read + toggle.
 *
 * Endpoints:
 *   GET   /api/admin/triggers        — list  (OWNER | EMPLOYEE)
 *   GET   /api/admin/triggers/{id}   — detail (OWNER | EMPLOYEE)
 *   PATCH /api/admin/triggers/{id}/enabled — toggle (OWNER only)
 *
 * Full editor (create/update/delete) deferred to M3 per locked decision.
 * Structured logging: op=trigger.{list,get} actor={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/triggers")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
@Slf4j
@RequiredArgsConstructor
public class TriggersController {

    private final TriggerService svc;

    @GetMapping
    public List<TriggerDto> list(Authentication auth) {
        log.info("op=trigger.list actor={} outcome=ok", actor(auth));
        return svc.list();
    }

    @GetMapping("/{id}")
    public TriggerDto get(@PathVariable UUID id, Authentication auth) {
        var dto = svc.get(id);
        log.info("op=trigger.get actor={} triggerId={} outcome=ok", actor(auth), id);
        return dto;
    }

    @PatchMapping("/{id}/enabled")
    @PreAuthorize("hasRole('OWNER')")
    public TriggerDto toggle(@PathVariable UUID id,
                             @RequestBody ToggleTriggerRequest req,
                             Authentication auth) {
        var dto = svc.setEnabled(id, Boolean.TRUE.equals(req.enabled()));
        log.info("op=trigger.toggle actor={} triggerId={} enabled={} outcome=ok",
            actor(auth), id, req.enabled());
        return dto;
    }

    private static String actor(Authentication auth) {
        return (auth != null) ? auth.getName() : "anonymous";
    }
}
