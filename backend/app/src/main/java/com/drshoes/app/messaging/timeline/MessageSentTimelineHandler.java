package com.drshoes.app.messaging.timeline;

import com.drshoes.app.audit.AuditLog;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageTemplateRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;

/**
 * Translates a MessageRouter service audit row into a {@link TimelineEvent} of kind
 * {@link TimelineEventKind#MESSAGE_SENT}.
 *
 * <h2>Matched rows</h2>
 * MessageRouter fires {@code @Audited(parent = "#orderId")} on two public entry points:
 * <ul>
 *   <li>{@code MessageRouter#sendManual} — operator-initiated send</li>
 *   <li>{@code MessageRouter#sendForTrigger} — trigger-engine send</li>
 * </ul>
 * Both produce an {@code INTERNAL} audit row with {@code status=0} and
 * {@code parent_entity_id = orderId}. This handler matches BOTH paths.
 *
 * <h2>HTTP row skip</h2>
 * HTTP rows for {@code POST /api/admin/orders/{uuid}/messages} are handled by the curator
 * (which returns {@code Optional.empty()} for that path), NOT here. This handler only
 * receives rows that have already passed the INTERNAL/status=0 check in the curator.
 *
 * <h2>Clock-skew tolerance</h2>
 * The message row {@code created_at} is set by the DB DEFAULT; the audit row
 * {@code created_at} is set by the JPA entity default. There can be a few milliseconds
 * of skew between them. We tolerate up to 2 seconds: any MessageEntity for the given
 * order whose {@code created_at} is at-or-before {@code auditRow.createdAt + 2 seconds}
 * is a candidate. The latest such candidate is selected (the most recently inserted
 * message that could have been produced by this service call).
 */
@Component
@RequiredArgsConstructor
public class MessageSentTimelineHandler {

    private static final String SEND_MANUAL   = "MessageRouter#sendManual";
    private static final String SEND_TRIGGER  = "MessageRouter#sendForTrigger";

    /** Clock-skew tolerance window: 2 seconds. */
    private static final long SKEW_TOLERANCE_SECONDS = 2L;

    private final MessageRepository messages;
    private final MessageTemplateRepository templates;

    /**
     * Returns a {@link TimelineEvent} if the audit row is a MessageRouter service row;
     * {@code null} otherwise (caller must null-check).
     *
     * @param row            the audit log row to inspect
     * @param actorFullName  resolved display name of the actor
     * @return curated event, or {@code null} if the row should not produce a MESSAGE_SENT event
     */
    public TimelineEvent toEvent(AuditLog row, String actorFullName) {
        if (row.getStatus() != 0) {
            return null;
        }
        String path = row.getPath();
        if (!SEND_MANUAL.equals(path) && !SEND_TRIGGER.equals(path)) {
            return null;
        }
        UUID orderId = row.getParentEntityId();
        if (orderId == null) {
            return null;
        }

        // Find the most recent message for this order whose created_at is within
        // the skew-tolerance window of the audit row's createdAt.
        Instant cutoff = row.getCreatedAt().plusSeconds(SKEW_TOLERANCE_SECONDS);
        OffsetDateTime cutoffOdt = cutoff.atOffset(ZoneOffset.UTC);

        List<MessageEntity> candidates = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        MessageEntity match = null;
        for (MessageEntity m : candidates) {
            if (m.getCreatedAt() != null && !m.getCreatedAt().isAfter(cutoffOdt)) {
                match = m; // keep updating — last one wins (latest before cutoff)
            }
        }

        if (match == null) {
            return null;
        }

        String templateName = match.getTemplateId() != null
                ? templates.findById(match.getTemplateId())
                           .map(MessageSentTimelineHandler::templateName)
                           .orElse("—")
                : "—";

        Map<String, String> labels = new HashMap<>();
        labels.put("messageId",    match.getId().toString());
        labels.put("channel",      match.getChannel());
        labels.put("templateName", templateName);
        if (match.getTriggerId() != null) {
            labels.put("triggerId", match.getTriggerId().toString());
        }

        return new TimelineEvent(
                row.getId(),
                TimelineEventKind.MESSAGE_SENT,
                row.getCreatedAt(),
                actorFullName,
                Map.copyOf(labels),
                null,
                null,
                null
        );
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private static String templateName(com.drshoes.app.messaging.domain.MessageTemplateEntity t) {
        String n = t.getName();
        return (n != null && !n.isBlank()) ? n : "—";
    }
}
