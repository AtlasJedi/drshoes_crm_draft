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
@Component
@RequiredArgsConstructor
public class MessageSentTimelineHandler {

    private static final String SEND_MANUAL   = "MessageRouter#sendManual";
    private static final String SEND_TRIGGER  = "MessageRouter#sendForTrigger";
    private static final long SKEW_TOLERANCE_SECONDS = 2L;

    private final MessageRepository messages;
    private final MessageTemplateRepository templates;
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
        Instant cutoff = row.getCreatedAt().plusSeconds(SKEW_TOLERANCE_SECONDS);
        OffsetDateTime cutoffOdt = cutoff.atOffset(ZoneOffset.UTC);

        List<MessageEntity> candidates = messages.findAllByOrderIdOrderByCreatedAtAsc(orderId);
        MessageEntity match = null;
        for (MessageEntity m : candidates) {
            if (m.getCreatedAt() != null && !m.getCreatedAt().isAfter(cutoffOdt)) {
                match = m;
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

    private static String templateName(com.drshoes.app.messaging.domain.MessageTemplateEntity t) {
        String n = t.getName();
        return (n != null && !n.isBlank()) ? n : "—";
    }
}
