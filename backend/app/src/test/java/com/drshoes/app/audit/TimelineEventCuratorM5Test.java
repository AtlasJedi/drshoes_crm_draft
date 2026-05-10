package com.drshoes.app.audit;

import com.drshoes.app.audit.dto.TimelineEvent;
import com.drshoes.app.audit.dto.TimelineEventKind;
import com.drshoes.app.messaging.timeline.MessageReconcileTimelineHandler;
import com.drshoes.app.messaging.timeline.MessageSentTimelineHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for M5 TimelineEventCurator path mappings.
 * Complements TimelineEventCuratorTest (which covers M1–M4 paths).
 *
 * Class-name suffix M5Test avoids merging with the existing M1–M4 test class,
 * keeping LOC per file within the 120-line cap.
 *
 * NOTE on class names: task 5-8 split MessageThreadService into read-side
 * MessageThreadService and write-side MessageThreadMutationService. All thread
 * mutation path strings now reference MessageThreadMutationService — updated
 * atomically with the service split in the same commit.
 */
class TimelineEventCuratorM5Test {

    private static final String ACTOR = "Anna Kowalska";

    private TimelineEventCurator curator;

    @BeforeEach
    void setUp() {
        MessageSentTimelineHandler noopSent =
            mock(MessageSentTimelineHandler.class);
        when(noopSent.toEvent(any(AuditLog.class), anyString())).thenReturn(null);

        MessageReconcileTimelineHandler noopReconcile =
            mock(MessageReconcileTimelineHandler.class);
        when(noopReconcile.toEvent(any(AuditLog.class), anyString())).thenReturn(null);

        curator = new TimelineEventCurator(noopSent, noopReconcile);
    }

    @Test
    void recordEmailInbound_mapsToMessageReceived() {
        AuditLog log = auditLog("InboundMessageService#recordEmailInbound");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.MESSAGE_RECEIVED);
    }

    @Test
    void recordSmsInbound_mapsToMessageReceived() {
        AuditLog log = auditLog("InboundMessageService#recordSmsInbound");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.MESSAGE_RECEIVED);
    }

    @Test
    void markRead_mapsToThreadMarkedRead() {
        AuditLog log = auditLog("MessageThreadMutationService#markRead");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.THREAD_MARKED_READ);
    }

    @Test
    void assignUnmatched_mapsToThreadAssigned() {
        AuditLog log = auditLog("MessageThreadMutationService#assignUnmatched");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.THREAD_ASSIGNED);
    }

    @Test
    void discardUnmatched_mapsToThreadDiscarded() {
        AuditLog log = auditLog("MessageThreadMutationService#discardUnmatched");

        Optional<TimelineEvent> result = curator.curate(log, ACTOR);

        assertThat(result).isPresent();
        assertThat(result.get().kind()).isEqualTo(TimelineEventKind.THREAD_DISCARDED);
    }

    // ── helper ───────────────────────────────────────────────────────────────

    private static AuditLog auditLog(String path) {
        var log = new AuditLog();
        log.setMethod("INTERNAL");
        log.setPath(path);
        log.setStatus(0);
        log.setActorId(UUID.randomUUID());
        return log;
    }
}
