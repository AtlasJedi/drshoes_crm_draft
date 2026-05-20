package com.drshoes.app.order;

import com.drshoes.app.order.OrderListPolicy.EffectiveFilter;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure-unit tests for OrderListPolicy.resolve().
 * No Spring context — policy is a static utility.
 *
 * Verifies the contract documented in
 * docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md.
 */
class OrderListPolicyTest {

    @Test
    void nullStatuses_returnsActiveStatusesPlusCutoff() {
        Instant before = Instant.now();

        EffectiveFilter f = OrderListPolicy.resolve(null);

        Instant after = Instant.now();
        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WSTEPNIE_PRZYJETE,
            OrderStatus.PRZYJETE,
            OrderStatus.W_REALIZACJI,
            OrderStatus.CZEKA_NA_KLIENTA,
            OrderStatus.GOTOWE_DO_ODBIORU);
        assertThat(f.wydaneCutoff()).isNotNull();
        // Cutoff should be ~30 days before now.
        Instant expectedCutoff = before.minus(Duration.ofDays(30));
        assertThat(f.wydaneCutoff()).isBetween(expectedCutoff, after.minus(Duration.ofDays(30)));
    }

    @Test
    void emptyStatuses_returnsActiveStatusesPlusCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(List.of());

        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WSTEPNIE_PRZYJETE,
            OrderStatus.PRZYJETE,
            OrderStatus.W_REALIZACJI,
            OrderStatus.CZEKA_NA_KLIENTA,
            OrderStatus.GOTOWE_DO_ODBIORU);
        assertThat(f.wydaneCutoff()).isNotNull();
    }

    @Test
    void anulowaneExplicitlyRequested_throws() {
        assertThatThrownBy(() -> OrderListPolicy.resolve(List.of(OrderStatus.ANULOWANE)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("status.anulowane.disallowed");
    }

    @Test
    void anulowaneMixedWithOthers_throws() {
        assertThatThrownBy(() -> OrderListPolicy.resolve(
                List.of(OrderStatus.PRZYJETE, OrderStatus.ANULOWANE)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("status.anulowane.disallowed");
    }

    @Test
    void singleWydane_escapeHatch_returnsWydaneOnlyNoCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(List.of(OrderStatus.WYDANE));

        assertThat(f.statuses()).containsExactly(OrderStatus.WYDANE);
        assertThat(f.wydaneCutoff()).isNull();
    }

    @Test
    void explicitListWithoutAnulowane_returnsAsIsNoCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(
            List.of(OrderStatus.PRZYJETE, OrderStatus.W_REALIZACJI));

        assertThat(f.statuses()).containsExactly(
            OrderStatus.PRZYJETE, OrderStatus.W_REALIZACJI);
        assertThat(f.wydaneCutoff()).isNull();
    }

    @Test
    void explicitListIncludingWydane_returnsAsIsNoCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(
            List.of(OrderStatus.WYDANE, OrderStatus.PRZYJETE));

        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WYDANE, OrderStatus.PRZYJETE);
        assertThat(f.wydaneCutoff()).isNull();
    }
}
