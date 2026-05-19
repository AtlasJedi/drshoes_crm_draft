package com.drshoes.app.order.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the canonical declaration order of OrderItemKind.
 * The enum order drives the dropdown UI order — DO NOT reorder without updating this test.
 * V033 (2026-05-19): CZYSZCZENIE (default), RENOWACJA, NAPRAWA, SZEWC, CUSTOM.
 */
class OrderItemKindTest {

    @Test
    void enumValuesAreExactlyFiveInCanonicalOrder() {
        OrderItemKind[] values = OrderItemKind.values();
        assertThat(values).hasSize(5);
        assertThat(values[0]).isEqualTo(OrderItemKind.CZYSZCZENIE);
        assertThat(values[1]).isEqualTo(OrderItemKind.RENOWACJA);
        assertThat(values[2]).isEqualTo(OrderItemKind.NAPRAWA);
        assertThat(values[3]).isEqualTo(OrderItemKind.SZEWC);
        assertThat(values[4]).isEqualTo(OrderItemKind.CUSTOM);
    }

    @Test
    void czyszczenieIsOrdinalZero() {
        // ordinal 0 = first declared = default for new items
        assertThat(OrderItemKind.CZYSZCZENIE.ordinal()).isZero();
    }

    @Test
    void enumNamesMatchExpected() {
        assertThat(OrderItemKind.CZYSZCZENIE.name()).isEqualTo("CZYSZCZENIE");
        assertThat(OrderItemKind.RENOWACJA.name()).isEqualTo("RENOWACJA");
        assertThat(OrderItemKind.NAPRAWA.name()).isEqualTo("NAPRAWA");
        assertThat(OrderItemKind.SZEWC.name()).isEqualTo("SZEWC");
        assertThat(OrderItemKind.CUSTOM.name()).isEqualTo("CUSTOM");
    }
}
