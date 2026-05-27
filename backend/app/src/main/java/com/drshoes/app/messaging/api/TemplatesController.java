package com.drshoes.app.messaging.api;

import com.drshoes.app.messaging.dto.CreateTemplateRequest;
import com.drshoes.app.messaging.dto.TemplateDto;
import com.drshoes.app.messaging.dto.UpdateTemplateRequest;
import com.drshoes.app.messaging.service.TemplateService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * REST controller for message template CRUD.
 *
 * Endpoints:
 *   GET    /api/admin/templates        — list all  (OWNER | EMPLOYEE)
 *   GET    /api/admin/templates/{id}   — detail    (OWNER | EMPLOYEE)
 *   POST   /api/admin/templates        — create    (OWNER only)
 *   PATCH  /api/admin/templates/{id}   — update    (OWNER only)
 *   DELETE /api/admin/templates/{id}   — soft-del  (OWNER only)
 *
 * Structured logging: op=template.{list,get} actor={} outcome=ok
 */
@RestController
@RequestMapping("/api/admin/templates")
@PreAuthorize("hasAnyRole('OWNER','EMPLOYEE')")
@Slf4j
@RequiredArgsConstructor
public class TemplatesController {

    private final TemplateService svc;

    @GetMapping
    public List<TemplateDto> list(Authentication auth) {
        log.info("op=template.list actor={} outcome=ok", actor(auth));
        return svc.list();
    }

    @GetMapping("/{id}")
    public TemplateDto get(@PathVariable UUID id, Authentication auth) {
        var dto = svc.get(id);
        log.info("op=template.get actor={} templateId={} outcome=ok", actor(auth), id);
        return dto;
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<TemplateDto> create(@RequestBody CreateTemplateRequest req,
                                              Authentication auth) {
        var created = svc.create(req);
        log.info("op=template.create actor={} templateId={} outcome=ok", actor(auth), created.id());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public TemplateDto update(@PathVariable UUID id,
                              @RequestBody UpdateTemplateRequest req,
                              Authentication auth) {
        var updated = svc.update(id, req);
        log.info("op=template.update actor={} templateId={} outcome=ok", actor(auth), id);
        return updated;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        svc.softDelete(id);
        log.info("op=template.delete actor={} templateId={} outcome=ok", actor(auth), id);
        return ResponseEntity.noContent().build();
    }

    private static String actor(Authentication auth) {
        return (auth != null) ? auth.getName() : "anonymous";
    }
}
