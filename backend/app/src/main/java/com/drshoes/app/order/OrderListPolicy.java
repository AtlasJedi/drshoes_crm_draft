package com.drshoes.app.order;

import com.drshoes.app.order.domain.OrderStatus;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
public final class OrderListPolicy {

    private OrderListPolicy() {}

    static final Set<OrderStatus> ACTIVE_STATUSES = EnumSet.of(
        OrderStatus.WSTEPNIE_PRZYJETE,
        OrderStatus.PRZYJETE,
        OrderStatus.W_REALIZACJI,
        OrderStatus.CZEKA_NA_KLIENTA,
        OrderStatus.GOTOWE_DO_ODBIORU);
    public record EffectiveFilter(List<OrderStatus> statuses, Instant wydaneCutoff) {}
    public static EffectiveFilter resolve(List<OrderStatus> rawStatuses) {
        if (rawStatuses != null && rawStatuses.contains(OrderStatus.ANULOWANE)) {
            throw new IllegalArgumentException("status.anulowane.disallowed");
        }
        if (rawStatuses == null || rawStatuses.isEmpty()) {
            return new EffectiveFilter(List.copyOf(ACTIVE_STATUSES), null);
        }
        return new EffectiveFilter(List.copyOf(rawStatuses), null);
    }
    public static EffectiveFilter resolveArchive() {
        return new EffectiveFilter(List.of(OrderStatus.WYDANE, OrderStatus.ANULOWANE), null);
    }
}
