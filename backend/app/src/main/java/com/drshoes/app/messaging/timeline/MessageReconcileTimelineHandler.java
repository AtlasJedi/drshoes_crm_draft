package com.drshoes.app.messaging.timeline;

import com.drshoes.app.audit.AuditLog;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.service.WebhookStatusReconciler;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Translates a {@link WebhookStatusReconciler} INTERNAL audit row into a
 * {@link TimelineEvent} of kind {@link TimelineEventKind#MESSAGE_DELIVERED} or
 * {@link TimelineEventKind#MESSAGE_FAILED}, depending on the audit path suffix.
 *
 * <h2>Matched rows</h2>
 * WebhookStatusReconciler writes INTERNAL audit rows with one of two paths:
 * <ul>
 *   <li>{@code WebhookStatusReconciler#applyDelivered} — delivery webhook applied</li>
 *   <li>{@code WebhookStatusReconciler#applyFailed}    — bounce webhook applied</li>
 * </ul>
 * Both rows have {@code status=0} and {@code parent_entity_id = orderId}.
 *
 * <h2>Logging</h2>
 * No logging — this class lives in the hot read path (curator family).
 * See {@link com.drshoes.app.audit.TimelineEventCurator} class-level javadoc.
 */
@Component
public class MessageReconcileTimelineHandler {

    /**
     * Returns a {@link TimelineEvent} if the audit row is a WebhookStatusReconciler
     * reconcile row; {@code null} otherwise (caller must null-check).
     *
     * @param row            the audit log row to inspect
     * @param actorFullName  resolved display name of the actor
     * @return curated event, or {@code null} if the row should not produce a reconcile event
     */
    public TimelineEvent toEvent(AuditLog row, String actorFullName) {
        if (row.getStatus() != 0) {
            return null;
        }
        String path = row.getPath();
        if (path == null) {
            return null;
        }

        TimelineEventKind kind;
        if (WebhookStatusReconciler.AUDIT_PATH_DELIVERED.equals(path)) {
            kind = TimelineEventKind.MESSAGE_DELIVERED;
        } else if (WebhookStatusReconciler.AUDIT_PATH_FAILED.equals(path)) {
            kind = TimelineEventKind.MESSAGE_FAILED;
        } else {
            return null;
        }

        UUID parentId = row.getParentEntityId();
        String orderIdLabel = parentId != null ? parentId.toString() : "";

        Map<String, String> labels = Map.of(
                "actorFullName", actorFullName,
                "orderId", orderIdLabel
        );

        return new TimelineEvent(row.getId(), kind, row.getCreatedAt(), actorFullName, labels);
    }
}
