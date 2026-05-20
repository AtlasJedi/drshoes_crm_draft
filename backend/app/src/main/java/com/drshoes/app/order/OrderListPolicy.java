package com.drshoes.app.order;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Normalizes raw status filter input from the controller into an
 * EffectiveFilter that the JPA Specification layer can consume.
 *
 * Default policy (no statuses passed):
 *   - Include all "active" statuses (NOT in {WYDANE, ANULOWANE})
 *   - Include WYDANE only when picked_up_at >= now - 30d
 *
 * Defense in depth: ANULOWANE explicitly requested → IllegalArgumentException.
 * The controller maps this to HTTP 400. The filter UI never offers ANULOWANE.
 *
 * Single explicit WYDANE pick: escape hatch returns all WYDANE (no cutoff).
 *
 * See spec: docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md
 */
public final class OrderListPolicy {

    private OrderListPolicy() {}

    static final int WYDANE_RECENT_WINDOW_DAYS = 30;

    static final Set<OrderStatus> ACTIVE_STATUSES = EnumSet.of(
        OrderStatus.WSTEPNIE_PRZYJETE,
        OrderStatus.PRZYJETE,
        OrderStatus.W_REALIZACJI,
        OrderStatus.CZEKA_NA_KLIENTA,
        OrderStatus.GOTOWE_DO_ODBIORU);

    /**
     * Result of resolving the raw status filter.
     *
     * @param statuses      statuses to include unconditionally
     * @param wydaneCutoff  if non-null, ALSO include WYDANE rows with picked_up_at >= cutoff
     *                      (i.e. the default-mode 30d window). null when caller picked statuses explicitly.
     */
    public record EffectiveFilter(List<OrderStatus> statuses, Instant wydaneCutoff) {}

    /**
     * Resolve raw status param into an EffectiveFilter.
     *
     * @throws IllegalArgumentException if ANULOWANE appears in the raw list (controller maps to 400)
     */
    public static EffectiveFilter resolve(List<OrderStatus> rawStatuses) {
        if (rawStatuses != null && rawStatuses.contains(OrderStatus.ANULOWANE)) {
            throw new IllegalArgumentException("status.anulowane.disallowed");
        }
        if (rawStatuses == null || rawStatuses.isEmpty()) {
            return new EffectiveFilter(
                List.copyOf(ACTIVE_STATUSES),
                Instant.now().minus(Duration.ofDays(WYDANE_RECENT_WINDOW_DAYS)));
        }
        // Explicit pick — no implicit WYDANE injection, no cutoff.
        return new EffectiveFilter(List.copyOf(rawStatuses), null);
    }
}
