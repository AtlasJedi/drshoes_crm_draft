package com.drshoes.app.storage.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.storage.service.StorageLocationService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * CRUD endpoints for the storage_location string set.
 * AuditLogAspect handles audit row writes (controller pointcut).
 */
@RestController
@RequestMapping("/api/admin/storage-locations")
public class StorageLocationController {

    private static final Logger log = LoggerFactory.getLogger(StorageLocationController.class);

    private final StorageLocationService svc;

    public StorageLocationController(StorageLocationService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<StorageLocationDto> list(
            @RequestParam(value = "includeInactive", defaultValue = "false") boolean includeInactive,
            @AuthenticationPrincipal AdminPrincipal me) {
        log.info("op=storageLocation.list actor={} includeInactive={} outcome=ok",
            me.email(), includeInactive);
        return (includeInactive ? svc.listAll() : svc.listActive())
            .stream().map(StorageLocationDto::from).toList();
    }

    @PostMapping
    public ResponseEntity<StorageLocationDto> create(
            @Valid @RequestBody CreateStorageLocationRequest req,
            @AuthenticationPrincipal AdminPrincipal me) {
        var created = svc.create(req.name());
        log.info("op=storageLocation.create actor={} id={} name={} outcome=ok",
            me.email(), created.getId(), created.getName());
        return ResponseEntity
            .created(URI.create("/api/admin/storage-locations/" + created.getId()))
            .body(StorageLocationDto.from(created));
    }

    @PatchMapping("/{id}")
    public StorageLocationDto update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStorageLocationRequest req,
            @AuthenticationPrincipal AdminPrincipal me) {
        var updated = svc.update(id, req.name(), req.position(), req.active());
        log.info("op=storageLocation.update actor={} id={} outcome=ok", me.email(), id);
        return StorageLocationDto.from(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id,
                                           @AuthenticationPrincipal AdminPrincipal me) {
        svc.deactivate(id);
        log.info("op=storageLocation.deactivate actor={} id={} outcome=ok", me.email(), id);
        return ResponseEntity.noContent().build();
    }
}
