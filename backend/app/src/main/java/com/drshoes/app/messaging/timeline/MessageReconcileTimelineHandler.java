package com.drshoes.app.messaging.timeline;

import com.drshoes.app.audit.AuditLog;
import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.service.WebhookStatusReconciler;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
@Component
public class MessageReconcileTimelineHandler {
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

        return new TimelineEvent(row.getId(), kind, row.getCreatedAt(), actorFullName, labels, null, null, null);
    }
}
