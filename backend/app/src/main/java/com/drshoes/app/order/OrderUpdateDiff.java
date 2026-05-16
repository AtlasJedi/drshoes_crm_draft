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

/**
 * Pure helper for computing a Polish-language diff string for OrderService.update.
 *
 * Returns a "; "-joined list of field-change strings, or null when nothing changed.
 * Used to populate audit_log.note so the timeline shows meaningful diffs instead of
 * generic "Zamówienie zaktualizowane" entries.
 *
 * Skipped fields: currentStorageLocationId (proto column, M10 hygiene deferred),
 * version (optimistic lock, not user-facing).
 */
public final class OrderUpdateDiff {

    private static final DateTimeFormatter DATE_FMT =
        DateTimeFormatter.ofPattern("dd.MM.yyyy").withZone(ZoneId.of("Europe/Warsaw"));

    private OrderUpdateDiff() {}

    /**
     * Computes a Polish diff string comparing the current order state to the incoming request.
     *
     * @param before           the current persisted Order (before mutations)
     * @param req              the incoming UpdateOrderRequest
     * @param userNameResolver function to resolve a UUID to a display name;
     *                         called only when assignedCraftsmanId changes
     * @return a non-blank diff string, or null when the effective request is a no-op
     */
    public static String computePolish(Order before, UpdateOrderRequest req,
                                       Function<UUID, String> userNameResolver) {
        List<String> parts = new ArrayList<>();

        // description
        if (req.description() != null && !Objects.equals(req.description(), before.getDescription())) {
            String oldVal = truncate(before.getDescription(), 30);
            String newVal = truncate(req.description(), 30);
            parts.add("opis: \"" + oldVal + "\" → \"" + newVal + "\"");
        }

        // plannedPickupAt
        if (req.plannedPickupAt() != null
                && !Objects.equals(req.plannedPickupAt(), before.getPlannedPickupAt())) {
            String oldDate = formatDate(before.getPlannedPickupAt());
            String newDate = formatDate(req.plannedPickupAt());
            parts.add("planowany odbiór: " + oldDate + " → " + newDate);
        }

        // assignedCraftsmanId
        if (req.assignedCraftsmanId() != null
                && !Objects.equals(req.assignedCraftsmanId(), before.getAssignedCraftsmanId())) {
            String oldName = resolveName(before.getAssignedCraftsmanId(), userNameResolver);
            String newName = resolveName(req.assignedCraftsmanId(), userNameResolver);
            parts.add("wykonawca: " + oldName + " → " + newName);
        }

        // cancelledReason
        if (req.cancelledReason() != null
                && !Objects.equals(req.cancelledReason(), before.getCancelledReason())) {
            String oldVal = truncate(before.getCancelledReason(), 30);
            String newVal = truncate(req.cancelledReason(), 30);
            parts.add("powód anulowania: \"" + oldVal + "\" → \"" + newVal + "\"");
        }

        // tags (content diff not parsed — just signal changed)
        if (req.tags() != null && !Objects.equals(req.tags(), before.getTags())) {
            parts.add("tagi: zmienione");
        }

        // quotedPriceCents
        if (req.quotedPriceCents() != null && req.quotedPriceCents() != before.getQuotedPriceCents()) {
            String oldPln = formatPln(before.getQuotedPriceCents());
            String newPln = formatPln(req.quotedPriceCents());
            parts.add("cena: " + oldPln + " → " + newPln);
        }

        // advancePaidCents
        if (req.advancePaidCents() != null && req.advancePaidCents() != before.getAdvancePaidCents()) {
            String oldPln = formatPln(before.getAdvancePaidCents());
            String newPln = formatPln(req.advancePaidCents());
            parts.add("zaliczka: " + oldPln + " → " + newPln);
        }

        if (parts.isEmpty()) return null;
        return String.join("; ", parts);
    }

    // ---- private helpers ----

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
