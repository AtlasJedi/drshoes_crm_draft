package com.drshoes.app.order;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.domain.OrderStatus;
import com.drshoes.app.order.domain.OrderSource;
import com.drshoes.app.order.dto.UpdateOrderRequest;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for OrderUpdateDiff.computePolish — pure logic, no Spring context needed.
 */
class OrderUpdateDiffTest {

    private static final DateTimeFormatter DATE_FMT =
        DateTimeFormatter.ofPattern("dd.MM.yyyy").withZone(ZoneId.of("Europe/Warsaw"));

    // ---- helpers ----

    private Order baseOrder() {
        Order o = new Order();
        // Use reflection-free approach: set fields via setters
        o.setDescription("stary opis");
        o.setPlannedPickupAt(null);
        o.setAssignedCraftsmanId(null);
        o.setCancelledReason(null);
        o.setTags("[]");
        o.setQuotedPriceCents(0);
        o.setAdvancePaidCents(0);
        return o;
    }

    private UpdateOrderRequest emptyReq() {
        return new UpdateOrderRequest(null, null, null, null, null, null, null, null, null);
    }

    // ---- test cases ----

    @Test
    void noChanges_returnsNull() {
        Order o = baseOrder();
        // Request with same values — all non-null fields equal the current order
        UpdateOrderRequest req = new UpdateOrderRequest(
            "stary opis", null, null, null, null, null, null, 0, 0);
        String diff = OrderUpdateDiff.computePolish(o, req, uuid -> "?");
        assertThat(diff).isNull();
    }

    @Test
    void onlyDescriptionChanged_returnsDiffString() {
        Order o = baseOrder();
        UpdateOrderRequest req = new UpdateOrderRequest(
            "nowy opis", null, null, null, null, null, null, null, null);
        String diff = OrderUpdateDiff.computePolish(o, req, null);
        assertThat(diff).isEqualTo("opis: \"stary opis\" → \"nowy opis\"");
    }

    @Test
    void onlyQuotedPriceCentsChanged_returnsCenaFormat() {
        Order o = baseOrder(); // quotedPriceCents = 0
        UpdateOrderRequest req = new UpdateOrderRequest(
            null, null, null, null, null, null, null, 10000, null);
        String diff = OrderUpdateDiff.computePolish(o, req, null);
        assertThat(diff).isEqualTo("cena: 0,00 zł → 100,00 zł");
    }

    @Test
    void multipleFieldsChanged_joinedWithSemicolon() {
        Order o = baseOrder();
        o.setQuotedPriceCents(500);
        o.setAdvancePaidCents(0);
        UpdateOrderRequest req = new UpdateOrderRequest(
            "nowy", null, null, null, null, null, null, 1000, 200);
        String diff = OrderUpdateDiff.computePolish(o, req, null);
        assertThat(diff).contains("; ");
        assertThat(diff).contains("opis:");
        assertThat(diff).contains("cena:");
        assertThat(diff).contains("zaliczka:");
    }

    @Test
    void descriptionChangedToNull_handledGracefully() {
        // req.description() == null means "don't touch description" — not a change to null
        // Actual null value cannot be sent via the request to clear the field (nullable patch)
        // So if req.description() is null, no diff should be emitted.
        Order o = baseOrder();
        UpdateOrderRequest req = emptyReq();
        String diff = OrderUpdateDiff.computePolish(o, req, null);
        assertThat(diff).isNull();
    }

    @Test
    void assignedCraftsmanId_resolvedThroughStubResolver() {
        Order o = baseOrder();
        UUID oldCraftsman = UUID.randomUUID();
        UUID newCraftsman = UUID.randomUUID();
        o.setAssignedCraftsmanId(oldCraftsman);
        UpdateOrderRequest req = new UpdateOrderRequest(
            null, null, newCraftsman, null, null, null, null, null, null);
        String diff = OrderUpdateDiff.computePolish(o, req, id -> {
            if (id.equals(oldCraftsman)) return "Jan Kowalski";
            if (id.equals(newCraftsman)) return "Maria Nowak";
            return "?";
        });
        assertThat(diff).isEqualTo("wykonawca: Jan Kowalski → Maria Nowak");
    }

    @Test
    void plannedPickupAt_formattedAsPolishDate() {
        Order o = baseOrder();
        Instant newDate = Instant.parse("2025-07-15T10:00:00Z");
        UpdateOrderRequest req = new UpdateOrderRequest(
            null, newDate, null, null, null, null, null, null, null);
        String diff = OrderUpdateDiff.computePolish(o, req, null);
        // old is null → "brak"
        assertThat(diff).isEqualTo("planowany odbiór: brak → 15.07.2025");
    }

    @Test
    void longDescription_truncatedTo30Chars() {
        Order o = baseOrder();
        o.setDescription("a".repeat(50));
        UpdateOrderRequest req = new UpdateOrderRequest(
            "b".repeat(50), null, null, null, null, null, null, null, null);
        String diff = OrderUpdateDiff.computePolish(o, req, null);
        assertThat(diff).isNotNull();
        // Each side should be truncated to 30
        assertThat(diff).contains("\"" + "a".repeat(30) + "\"");
        assertThat(diff).contains("\"" + "b".repeat(30) + "\"");
    }
}
