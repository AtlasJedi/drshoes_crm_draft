package com.drshoes.app.sklep;

import com.drshoes.app.auth.principal.AdminPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Business logic for the Sklep product reservation queue.
 *
 * Methods:
 *   list(productId)      — active reservations for one product (oldest-first)
 *   listLatest(limit)    — latest N active reservations across all products (dashboard panel)
 *   cancel(productId, id) — soft-cancel a reservation (sets status=CANCELLED + cancelledAt)
 *
 * Structured logging: op=<method> actor=<email> productId=<id> outcome=<ok|error>
 */
@Service
public class ProductReservationService {

    private static final Logger log = LoggerFactory.getLogger(ProductReservationService.class);

    private final ProductReservationRepository repo;

    public ProductReservationService(ProductReservationRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<ProductReservationDto> list(UUID productId, AdminPrincipal actor) {
        var items = repo.findByProductIdAndStatusNotOrderByReservedAtAsc(productId, "CANCELLED")
            .stream().map(ProductReservationDto::from).toList();
        log.info("op=ProductReservationService.list actor={} productId={} count={} outcome=ok",
            actor.email(), productId, items.size());
        return items;
    }

    @Transactional(readOnly = true)
    public List<ProductReservationDto> listLatest(int limit, AdminPrincipal actor) {
        var items = repo.findLatestActive(PageRequest.of(0, limit))
            .stream().map(ProductReservationDto::from).toList();
        log.info("op=ProductReservationService.listLatest actor={} limit={} count={} outcome=ok",
            actor.email(), limit, items.size());
        return items;
    }

    @Transactional
    public void cancel(UUID productId, UUID reservationId, AdminPrincipal actor) {
        var reservation = repo.findById(reservationId).orElseThrow(
            () -> new IllegalArgumentException("Reservation not found: " + reservationId));
        if (!reservation.getProductId().equals(productId)) {
            throw new IllegalArgumentException(
                "Reservation " + reservationId + " does not belong to product " + productId);
        }
        if ("CANCELLED".equals(reservation.getStatus())) {
            log.warn("op=ProductReservationService.cancel actor={} reservationId={} outcome=already-cancelled",
                actor.email(), reservationId);
            return;
        }
        reservation.cancel();
        repo.save(reservation);
        log.info("op=ProductReservationService.cancel actor={} productId={} reservationId={} outcome=ok",
            actor.email(), productId, reservationId);
    }
}
