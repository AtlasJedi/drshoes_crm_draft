package com.drshoes.app.order;

import com.drshoes.app.order.OrderListPolicy.EffectiveFilter;
import com.drshoes.app.order.domain.OrderStatus;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure-unit tests for OrderListPolicy.resolve() and resolveArchive().
 * No Spring context — policy is a static utility.
 *
 * Verifies the contract documented in
 * docs/superpowers/specs/2026-05-20-order-list-scale-1k-design.md.
 */
class OrderListPolicyTest {

    @Test
    void defaultResolve_excludesWydane() {
        EffectiveFilter f = OrderListPolicy.resolve(null);
        assertThat(f.statuses()).doesNotContain(OrderStatus.WYDANE);
    }

    @Test
    void defaultResolve_excludesAnulowane() {
        EffectiveFilter f = OrderListPolicy.resolve(null);
        assertThat(f.statuses()).doesNotContain(OrderStatus.ANULOWANE);
    }

    @Test
    void defaultResolve_noWydaneCutoff() {
        EffectiveFilter f = OrderListPolicy.resolve(null);
        assertThat(f.wydaneCutoff()).isNull();
    }

    @Test
    void defaultResolve_containsAllActiveStatuses() {
        EffectiveFilter f = OrderListPolicy.resolve(null);
        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WSTEPNIE_PRZYJETE,
            OrderStatus.PRZYJETE,
            OrderStatus.W_REALIZACJI,
            OrderStatus.CZEKA_NA_KLIENTA,
            OrderStatus.GOTOWE_DO_ODBIORU);
    }

    @Test
    void emptyStatuses_behavesLikeDefault() {
        EffectiveFilter f = OrderListPolicy.resolve(List.of());
        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WSTEPNIE_PRZYJETE,
            OrderStatus.PRZYJETE,
            OrderStatus.W_REALIZACJI,
            OrderStatus.CZEKA_NA_KLIENTA,
            OrderStatus.GOTOWE_DO_ODBIORU);
        assertThat(f.wydaneCutoff()).isNull();
    }

    @Test
    void resolve_throwsOnAnulowane() {
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
    void resolveArchive_containsWydaneAndAnulowane() {
        EffectiveFilter f = OrderListPolicy.resolveArchive();
        assertThat(f.statuses()).containsExactlyInAnyOrder(
            OrderStatus.WYDANE, OrderStatus.ANULOWANE);
        assertThat(f.wydaneCutoff()).isNull();
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
}
