package com.drshoes.app.order;

import com.drshoes.app.order.domain.Order;
import com.drshoes.app.order.dto.UpdateOrderRequest;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
public final class OrderUpdateDiff {

    private static final DateTimeFormatter DATE_FMT =
        DateTimeFormatter.ofPattern("dd.MM.yyyy").withZone(ZoneId.of("Europe/Warsaw"));

    private OrderUpdateDiff() {}
    public static String computePolish(Order before, UpdateOrderRequest req,
                                       Function<UUID, String> userNameResolver) {
        List<String> parts = new ArrayList<>();
        if (req.description() != null && !Objects.equals(req.description(), before.getDescription())) {
            String oldVal = quote(truncate(before.getDescription(), 30));
            String newVal = quote(truncate(req.description(), 30));
            parts.add("Opis zmieniony z " + oldVal + " na " + newVal);
        }
        if (req.plannedPickupAt() != null
                && !Objects.equals(req.plannedPickupAt(), before.getPlannedPickupAt())) {
            String oldDate = formatDate(before.getPlannedPickupAt());
            String newDate = formatDate(req.plannedPickupAt());
            parts.add("Planowany odbiór zmieniony z " + oldDate + " na " + newDate);
        }
        if (req.assignedCraftsmanId() != null
                && !Objects.equals(req.assignedCraftsmanId(), before.getAssignedCraftsmanId())) {
            String oldName = resolveName(before.getAssignedCraftsmanId(), userNameResolver);
            String newName = resolveName(req.assignedCraftsmanId(), userNameResolver);
            parts.add("Wykonawca zmieniony z " + oldName + " na " + newName);
        }
        if (req.cancelledReason() != null
                && !Objects.equals(req.cancelledReason(), before.getCancelledReason())) {
            String oldVal = quote(truncate(before.getCancelledReason(), 30));
            String newVal = quote(truncate(req.cancelledReason(), 30));
            parts.add("Powód anulowania zmieniony z " + oldVal + " na " + newVal);
        }
        if (req.tags() != null && !Objects.equals(req.tags(), before.getTags())) {
            parts.add("Tagi zaktualizowane");
        }
        if (req.quotedPriceCents() != null && req.quotedPriceCents() != before.getQuotedPriceCents()) {
            String oldPln = formatPln(before.getQuotedPriceCents());
            String newPln = formatPln(req.quotedPriceCents());
            parts.add("Cena zmieniona z " + oldPln + " na " + newPln);
        }
        if (req.advancePaidCents() != null && req.advancePaidCents() != before.getAdvancePaidCents()) {
            String oldPln = formatPln(before.getAdvancePaidCents());
            String newPln = formatPln(req.advancePaidCents());
            parts.add("Zaliczka zmieniona z " + oldPln + " na " + newPln);
        }

        if (parts.isEmpty()) return null;
        return String.join(" · ", parts);
    }

    private static String quote(String s) {
        return "„" + s + "”";
    }

    static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }

    static String formatDate(Instant instant) {
        if (instant == null) return "brak";
        return DATE_FMT.format(instant);
    }

    static String formatPln(int cents) {
        return String.format(Locale.forLanguageTag("pl-PL"), "%.2f zł", cents / 100.0);
    }

    private static String resolveName(UUID id, Function<UUID, String> resolver) {
        if (id == null) return "brak";
        if (resolver == null) return id.toString().substring(0, 8);
        String name = resolver.apply(id);
        return name != null ? name : "?";
    }
}
