package com.drshoes.app.audit;

import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.timeline.MessageReconcileTimelineHandler;
import com.drshoes.app.messaging.timeline.MessageSentTimelineHandler;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
@Component
@RequiredArgsConstructor
public class TimelineEventCurator {
    private static final Pattern ORDER_UUID_PATTERN =
        Pattern.compile("/api/admin/orders/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:/.*)?$");
    private static final Pattern ORDER_CREATE_PATTERN =
        Pattern.compile("^/api/admin/orders$");
    private static final Pattern ITEMS_SEGMENT_PATTERN =
        Pattern.compile("/api/admin/orders/[^/]+/items(?:/.*)?$");
    private static final Pattern MESSAGES_SEGMENT_PATTERN =
        Pattern.compile("/api/admin/orders/[^/]+/messages(?:/.*)?$");
    private static final Pattern INTERNAL_ADD_ITEM =
        Pattern.compile("^OrderService#addItem");
    private static final Pattern INTERNAL_UPDATE_ITEM =
        Pattern.compile("^OrderService#updateItem");
    private static final Pattern INTERNAL_REMOVE_ITEM =
        Pattern.compile("^OrderService#removeItem");
    private static final Pattern INTERNAL_PHOTO_UPLOADED =
        Pattern.compile("^PhotoService#upload$");
    private static final Pattern INTERNAL_PHOTO_DELETED =
        Pattern.compile("^PhotoService#delete$");
    private static final Pattern INTERNAL_PHOTO_RELABELED =
        Pattern.compile("^PhotoService#relabel$");
    private static final Pattern INTERNAL_EMAIL_INBOUND =
        Pattern.compile("^InboundMessageService#recordEmailInbound$");
    private static final Pattern INTERNAL_SMS_INBOUND =
        Pattern.compile("^InboundMessageService#recordSmsInbound$");
    private static final Pattern INTERNAL_THREAD_MARK_READ =
        Pattern.compile("^MessageThreadMutationService#markRead$");
    private static final Pattern INTERNAL_THREAD_ASSIGN =
        Pattern.compile("^MessageThreadMutationService#assignUnmatched$");
    private static final Pattern INTERNAL_THREAD_DISCARD =
        Pattern.compile("^MessageThreadMutationService#discardUnmatched$");
    private static final Pattern PHOTOS_SEGMENT_PATTERN =
        Pattern.compile("/api/admin/orders/[^/]+/photos(?:/.*)?$");

    private final MessageSentTimelineHandler     messagingHandler;
    private final MessageReconcileTimelineHandler reconcileHandler;
    public Optional<TimelineEvent> curate(AuditLog log, String actorFullName) {
        String method = log.getMethod();
        String path   = log.getPath();
        int    status = log.getStatus();

        if ("INTERNAL".equals(method)) {
            return curateInternal(log, path, actorFullName);
        }
        if (ITEMS_SEGMENT_PATTERN.matcher(path).find()) {
            return Optional.empty();
        }
        if (MESSAGES_SEGMENT_PATTERN.matcher(path).find()) {
            return Optional.empty();
        }
        if (PHOTOS_SEGMENT_PATTERN.matcher(path).find()) {
            return Optional.empty();
        }
        if ("POST".equals(method) && status == 201 && ORDER_CREATE_PATTERN.matcher(path).matches()) {
            return Optional.of(event(log, TimelineEventKind.ORDER_CREATED, actorFullName,
                Map.of("path", path)));
        }
        Matcher m = ORDER_UUID_PATTERN.matcher(path);
        if (!m.find()) {
            return Optional.empty();
        }
        String orderId = m.group(1);
        if ("POST".equals(method) && status == 200 && path.endsWith("/status")) {
            TimelineEventKind kind = "WYDANE".equals(log.getTargetStatus())
                ? TimelineEventKind.DONE
                : TimelineEventKind.STATUS_CHANGED;
            return Optional.of(event(log, kind, actorFullName,
                Map.of("path", path, "orderId", orderId)));
        }
        if ("DELETE".equals(method) && status == 204 && path.equals("/api/admin/orders/" + orderId)) {
            return Optional.of(event(log, TimelineEventKind.ORDER_SOFT_DELETED, actorFullName,
                Map.of("path", path, "orderId", orderId)));
        }
        if ("PATCH".equals(method) && status == 200 && path.equals("/api/admin/orders/" + orderId)) {
            return Optional.of(event(log, TimelineEventKind.ORDER_UPDATED, actorFullName,
                Map.of("path", path, "orderId", orderId)));
        }
        if ("POST".equals(method) && (status == 200 || status == 201) && path.endsWith("/notes")) {
            return Optional.of(event(log, TimelineEventKind.ORDER_NOTE, actorFullName,
                Map.of("path", path, "orderId", orderId)));
        }

        return Optional.empty();
    }

    private Optional<TimelineEvent> curateInternal(AuditLog log, String path, String actorFullName) {
        TimelineEvent msgEvent = messagingHandler.toEvent(log, actorFullName);
        if (msgEvent != null) {
            return Optional.of(msgEvent);
        }
        TimelineEvent reconcileEvent = reconcileHandler.toEvent(log, actorFullName);
        if (reconcileEvent != null) {
            return Optional.of(reconcileEvent);
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
        if (INTERNAL_PHOTO_UPLOADED.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.PHOTO_UPLOADED, actorFullName, labels));
        }
        if (INTERNAL_PHOTO_DELETED.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.PHOTO_DELETED, actorFullName, labels));
        }
        if (INTERNAL_PHOTO_RELABELED.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.PHOTO_RELABELED, actorFullName, labels));
        }
        if (INTERNAL_EMAIL_INBOUND.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.MESSAGE_RECEIVED, actorFullName, labels));
        }
        if (INTERNAL_SMS_INBOUND.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.MESSAGE_RECEIVED, actorFullName, labels));
        }
        if (INTERNAL_THREAD_MARK_READ.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.THREAD_MARKED_READ, actorFullName, labels));
        }
        if (INTERNAL_THREAD_ASSIGN.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.THREAD_ASSIGNED, actorFullName, labels));
        }
        if (INTERNAL_THREAD_DISCARD.matcher(path).find()) {
            return Optional.of(event(log, TimelineEventKind.THREAD_DISCARDED, actorFullName, labels));
        }

        return Optional.empty();
    }

    private static TimelineEvent event(AuditLog log, TimelineEventKind kind,
                                        String actorFullName, Map<String, String> labels) {
        return new TimelineEvent(log.getId(), kind, log.getCreatedAt(), actorFullName, labels,
            log.getNote(), log.getLocationFrom(), log.getLocationTo());
    }
}
