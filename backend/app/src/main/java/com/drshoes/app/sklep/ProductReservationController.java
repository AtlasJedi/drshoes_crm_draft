package com.drshoes.app.sklep;

import com.drshoes.app.auth.principal.AdminPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
@RestController
@RequestMapping("/api/admin/sklep")
@Slf4j
@RequiredArgsConstructor
public class ProductReservationController {

    private final ProductReservationService svc;
    @GetMapping("/{productId}/reservations")
    public List<ProductReservationDto> list(
        @PathVariable UUID productId,
        @AuthenticationPrincipal AdminPrincipal actor
    ) {
        log.info("op=listReservations actor={} productId={}", actor.email(), productId);
        return svc.list(productId, actor);
    }
    @GetMapping("/reservations")
    public List<ProductReservationDto> listLatest(
        @RequestParam(name = "limit", defaultValue = "10") int limit,
        @AuthenticationPrincipal AdminPrincipal actor
    ) {
        int effectiveLimit = Math.min(limit, 50);
        log.info("op=listLatestReservations actor={} limit={}", actor.email(), effectiveLimit);
        return svc.listLatest(effectiveLimit, actor);
    }
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
