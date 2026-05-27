package com.drshoes.app.order.api;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.order.service.OrderNotesService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

/**
 * POST /api/admin/orders/{orderId}/notes
 * Adds a free-text note (and/or location move) to the order's history.
 *
 * AuditLogAspect writes the audit row from method+path+note+location-diff.
 * Location diff is communicated to the aspect via HttpServletRequest attributes
 * set after the service returns — the aspect reads them in the same request thread.
 */
@RestController
@RequestMapping("/api/admin/orders/{orderId}/notes")
@Slf4j
@RequiredArgsConstructor
public class OrderNotesController {

    private final OrderNotesService svc;

    @PostMapping
    public ResponseEntity<AddOrderNoteResponse> add(
            @PathVariable UUID orderId,
            @Valid @RequestBody AddOrderNoteRequest req,
            @AuthenticationPrincipal AdminPrincipal me,
            HttpServletRequest httpReq) {

        OrderNotesService.Result r = svc.addNote(orderId, req.note(), req.location());

        // Thread location diff to the AuditLogAspect via request attributes.
        // The aspect runs after this method returns (same thread); request lifecycle
        // cleans up attributes — no manual clear needed.
        httpReq.setAttribute("audit.locationFrom", r.oldLocation());
        httpReq.setAttribute("audit.locationTo",   r.newLocation());

        log.info("op=orderNote.add actor={} orderId={} hasNote={} hasLocationMove={} outcome=ok",
            me.email(), orderId, r.note() != null, r.newLocation() != null);

        AddOrderNoteResponse resp = new AddOrderNoteResponse(
            new UUID(0, 0),
            r.note(),
            r.oldLocation(),
            r.newLocation(),
            Instant.now()
        );
        return ResponseEntity
            .created(URI.create("/api/admin/orders/" + orderId + "/audit-log"))
            .body(resp);
    }
}
