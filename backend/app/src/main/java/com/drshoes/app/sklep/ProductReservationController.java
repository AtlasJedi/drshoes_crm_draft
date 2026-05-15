package com.drshoes.app.sklep;

import com.drshoes.app.auth.principal.AdminPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for the Sklep product reservation queue.
 *
 * Endpoints:
 *   GET    /api/admin/sklep/{productId}/reservations            — list active for one product
 *   GET    /api/admin/sklep/reservations?limit=N               — latest N across all products
 *   DELETE /api/admin/sklep/{productId}/reservations/{id}      — cancel reservation
 *
 * All endpoints require authenticated admin session (enforced by SecurityConfig).
 * Structured logging: op=<method> actor=<email> outcome=ok
 *
 * NOTE: Two separate @RequestMapping levels used to avoid path-variable ambiguity between
 * the "latest across all" endpoint and the per-product endpoint.
 */
@RestController
@RequestMapping("/api/admin/sklep")
public class ProductReservationController {

    private static final Logger log = LoggerFactory.getLogger(ProductReservationController.class);

    private final ProductReservationService svc;

    public ProductReservationController(ProductReservationService svc) {
        this.svc = svc;
    }

    /**
     * GET /api/admin/sklep/{productId}/reservations
     * Returns active (non-cancelled) reservations for a single product, oldest-first.
     */
    @GetMapping("/{productId}/reservations")
    public List<ProductReservationDto> list(
        @PathVariable UUID productId,
        @AuthenticationPrincipal AdminPrincipal actor
    ) {
        log.info("op=listReservations actor={} productId={}", actor.email(), productId);
        return svc.list(productId, actor);
    }

    /**
     * GET /api/admin/sklep/reservations?limit=3
     * Returns the latest N active reservations across all products (newest-first).
     * Used by FreshReservationsPanel on the admin dashboard.
     */
    @GetMapping("/reservations")
    public List<ProductReservationDto> listLatest(
        @RequestParam(name = "limit", defaultValue = "10") int limit,
        @AuthenticationPrincipal AdminPrincipal actor
    ) {
        int effectiveLimit = Math.min(limit, 50); // safety cap
        log.info("op=listLatestReservations actor={} limit={}", actor.email(), effectiveLimit);
        return svc.listLatest(effectiveLimit, actor);
    }

    /**
     * DELETE /api/admin/sklep/{productId}/reservations/{id}
     * Cancels a reservation (soft-delete: sets status=CANCELLED + cancelledAt).
     */
    @DeleteMapping("/{productId}/reservations/{id}")
    public ResponseEntity<Void> cancel(
        @PathVariable UUID productId,
        @PathVariable UUID id,
        @AuthenticationPrincipal AdminPrincipal actor
    ) {
        log.info("op=cancelReservation actor={} productId={} reservationId={}", actor.email(), productId, id);
        svc.cancel(productId, id, actor);
        return ResponseEntity.noContent().build();
    }
}
