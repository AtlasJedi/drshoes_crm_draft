package com.drshoes.app.audit;

import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.timeline.MessageSentTimelineHandler;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Translates raw {@link AuditLog} rows into curated {@link TimelineEvent} projections
 * for the admin order-timeline UI.
 *
 * <h2>Design</h2>
 * Dispatch is keyed on {@code (method, path, status)} via a small set of compiled
 * {@link Pattern}s. No field-level diff is available in M1 — AuditLog does not
 * capture request bodies. Body-capture enhancements (field-level diffs,
 * ASSIGNEE_CHANGED, PICKUP_DATE_CHANGED) are explicit M2 work.
 *
 * <h2>Two-row audit semantics for item operations</h2>
 * Each successful admin item-op (add/update/remove) produces TWO audit rows:
 * one HTTP row from the controller advice + one INTERNAL row from the {@code @Audited}
 * service advice. The HTTP row is skipped here; only the INTERNAL row is emitted,
 * to avoid double-counting in the timeline.
 *
 * <h2>URL prefix assumption</h2>
 * All admin paths are expected under {@code /api/admin/...}. This prefix is stable:
 * {@code server.servlet.context-path} is not customised in {@code application.yaml}.
 * If the prefix changes, the patterns in this class must be updated. This is
 * acknowledged path-pattern brittleness — an acceptable M1 trade-off.
 *
 * <h2>Logging</h2>
 * No logging from this class — it lives in a hot read path (timeline reads per page
 * load). Callers may log at DEBUG if needed.
 */
@Component
public class TimelineEventCurator {

    // Matches /api/admin/orders/{uuid} with an optional suffix (e.g. /status, /items)
    private static final Pattern ORDER_UUID_PATTERN =
        Pattern.compile("/api/admin/orders/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:/.*)?$");

    // Exact path for POST /api/admin/orders (order creation — no UUID segment)
    private static final Pattern ORDER_CREATE_PATTERN =
        Pattern.compile("^/api/admin/orders$");

    // Paths that include /items — HTTP item-op rows to skip
    private static final Pattern ITEMS_SEGMENT_PATTERN =
        Pattern.compile("/api/admin/orders/[^/]+/items(?:/.*)?$");

    // HTTP row for POST /api/admin/orders/{uuid}/messages — skip to avoid
    // double-counting; the INTERNAL MessageRouter audit row is the canonical source.
    private static final Pattern MESSAGES_SEGMENT_PATTERN =
        Pattern.compile("/api/admin/orders/[^/]+/messages(?:/.*)?$");

    // INTERNAL service-method paths produced by @Audited aspect
    private static final Pattern INTERNAL_ADD_ITEM =
        Pattern.compile("^OrderService#addItem");
    private static final Pattern INTERNAL_UPDATE_ITEM =
        Pattern.compile("^OrderService#updateItem");
    private static final Pattern INTERNAL_REMOVE_ITEM =
        Pattern.compile("^OrderService#removeItem");

    private final MessageSentTimelineHandler messagingHandler;

    public TimelineEventCurator(MessageSentTimelineHandler messagingHandler) {
        this.messagingHandler = messagingHandler;
    }

    /**
     * Curates a single audit log row into a timeline event.
     *
     * @param log           the audit row to interpret
     * @param actorFullName resolved display name of the actor (caller must resolve from actorId)
     * @return the curated event, or {@link Optional#empty()} if the row should be skipped
     */
    public Optional<TimelineEvent> curate(AuditLog log, String actorFullName) {
        String method = log.getMethod();
        String path   = log.getPath();
        int    status = log.getStatus();

        if ("INTERNAL".equals(method)) {
            return curateInternal(log, path, actorFullName);
        }

        // Skip HTTP item-op rows — the INTERNAL row covers them
        if (ITEMS_SEGMENT_PATTERN.matcher(path).find()) {
            return Optional.empty();
        }

        // Skip HTTP message rows (POST /api/admin/orders/{uuid}/messages) —
        // the INTERNAL MessageRouter audit row is the canonical source for MESSAGE_SENT.
        if (MESSAGES_SEGMENT_PATTERN.matcher(path).find()) {
            return Optional.empty();
        }

        // POST /api/admin/orders → ORDER_CREATED
        if ("POST".equals(method) && status == 201 && ORDER_CREATE_PATTERN.matcher(path).matches()) {
            return Optional.of(event(log, TimelineEventKind.ORDER_CREATED, actorFullName,
                Map.of("path", path)));
        }

        // Paths that include a UUID segment
        Matcher m = ORDER_UUID_PATTERN.matcher(path);
        if (!m.find()) {
            return Optional.empty();
        }
        String orderId = m.group(1);

        // POST /api/admin/orders/{uuid}/status → STATUS_CHANGED
        if ("POST".equals(method) && status == 200 && path.endsWith("/status")) {
            return Optional.of(event(log, TimelineEventKind.STATUS_CHANGED, actorFullName,
                Map.of("path", path, "orderId", orderId)));
        }

        // DELETE /api/admin/orders/{uuid} → ORDER_SOFT_DELETED
        if ("DELETE".equals(method) && status == 204 && path.equals("/api/admin/orders/" + orderId)) {
            return Optional.of(event(log, TimelineEventKind.ORDER_SOFT_DELETED, actorFullName,
                Map.of("path", path, "orderId", orderId)));
        }

        // PATCH /api/admin/orders/{uuid} (no /status, no /items suffix) → ORDER_UPDATED
        if ("PATCH".equals(method) && status == 200 && path.equals("/api/admin/orders/" + orderId)) {
            return Optional.of(event(log, TimelineEventKind.ORDER_UPDATED, actorFullName,
                Map.of("path", path, "orderId", orderId)));
        }

        return Optional.empty();
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private Optional<TimelineEvent> curateInternal(AuditLog log, String path, String actorFullName) {
        // M2: dispatch MessageRouter service rows to the messaging handler first
        TimelineEvent msgEvent = messagingHandler.toEvent(log, actorFullName);
        if (msgEvent != null) {
            return Optional.of(msgEvent);
        }

        UUID parentId = log.getParentEntityId();
        String orderIdLabel = parentId != null ? parentId.toString() : "";
        Map<String, String> labels = Map.of("actorFullName", actorFullName, "orderId", orderIdLabel);

        if (INTERNAL_ADD_ITEM.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.ITEM_ADDED, actorFullName, labels));
        }
        if (INTERNAL_UPDATE_ITEM.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.ITEM_EDITED, actorFullName, labels));
        }
        if (INTERNAL_REMOVE_ITEM.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.ITEM_REMOVED, actorFullName, labels));
        }
        return Optional.empty();
    }

    private static TimelineEvent event(AuditLog log, TimelineEventKind kind,
                                        String actorFullName, Map<String, String> labels) {
        return new TimelineEvent(log.getId(), kind, log.getCreatedAt(), actorFullName, labels);
    }
}
