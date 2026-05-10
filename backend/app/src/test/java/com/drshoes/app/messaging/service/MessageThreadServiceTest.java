package com.drshoes.app.messaging.service;

import com.drshoes.app.auth.principal.AdminPrincipal;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageThreadServiceTest {

    @Mock MessageThreadRepository threads;
    @Mock MessageRepository messages;

    MessageThreadService svc;
    MessageThreadMutationService mutSvc;

    AdminPrincipal actor = new AdminPrincipal(UUID.randomUUID(), "owner@drshoes.pl", "OWNER");

    @BeforeEach
    void setUp() {
        svc    = new MessageThreadService(threads);
        mutSvc = new MessageThreadMutationService(threads, messages);
    }

    // ---- findOrCreateForClient(clientId, channel) ----

    @Test
    @DisplayName("findOrCreateForClient: returns existing thread for same clientId+channel")
    void findOrCreateForClient_returnsExisting() {
        UUID clientId = UUID.randomUUID();
        var existing = thread(clientId, "EMAIL");
        when(threads.findFirstByClientIdAndChannelOrderByCreatedAtAsc(clientId, "EMAIL"))
            .thenReturn(Optional.of(existing));

        var result = svc.findOrCreateForClient(clientId, "EMAIL");

        assertThat(result.getId()).isEqualTo(existing.getId());
        verify(threads, never()).save(any());
    }

    @Test
    @DisplayName("findOrCreateForClient: creates new thread when none found")
    void findOrCreateForClient_createsNew() {
        UUID clientId = UUID.randomUUID();
        when(threads.findFirstByClientIdAndChannelOrderByCreatedAtAsc(clientId, "SMS"))
            .thenReturn(Optional.empty());
        when(threads.save(any())).thenAnswer(inv -> {
            MessageThreadEntity t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        var result = svc.findOrCreateForClient(clientId, "SMS");

        assertThat(result.getClientId()).isEqualTo(clientId);
        assertThat(result.getChannel()).isEqualTo("SMS");
        verify(threads).save(any());
    }

    // ---- findOrCreateForRawSender(rawSender, channel) ----

    @Test
    @DisplayName("findOrCreateForRawSender: returns existing unmatched thread")
    void findOrCreateForRawSender_returnsExisting() {
        String raw = "+48506220119";
        var existing = unmatchedThread(raw, "SMS");
        when(threads.findFirstByRawSenderAndChannelOrderByCreatedAtAsc(raw, "SMS"))
            .thenReturn(Optional.of(existing));

        var result = svc.findOrCreateForRawSender(raw, "SMS");

        assertThat(result.getRawSender()).isEqualTo(raw);
        verify(threads, never()).save(any());
    }

    @Test
    @DisplayName("findOrCreateForRawSender: creates new unmatched thread when none found")
    void findOrCreateForRawSender_createsNew() {
        String raw = "unknown@example.com";
        when(threads.findFirstByRawSenderAndChannelOrderByCreatedAtAsc(raw, "EMAIL"))
            .thenReturn(Optional.empty());
        when(threads.save(any())).thenAnswer(inv -> {
            MessageThreadEntity t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        var result = svc.findOrCreateForRawSender(raw, "EMAIL");

        assertThat(result.getRawSender()).isEqualTo(raw);
        assertThat(result.getClientId()).isNull();
        verify(threads).save(any());
    }

    // ---- markRead ----

    @Test
    @DisplayName("markRead: sets unreadCount=0 and saves")
    void markRead_setsZero() {
        UUID threadId = UUID.randomUUID();
        var t = thread(UUID.randomUUID(), "EMAIL");
        t.setId(threadId);
        t.setUnreadCount(5);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));
        when(threads.save(any())).thenReturn(t);

        mutSvc.markRead(threadId, actor);

        assertThat(t.getUnreadCount()).isZero();
        verify(threads).save(t);
    }

    @Test
    @DisplayName("markRead: throws 404 for unknown thread")
    void markRead_notFound() {
        UUID threadId = UUID.randomUUID();
        when(threads.findById(threadId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mutSvc.markRead(threadId, actor))
            .isInstanceOf(ResponseStatusException.class);
    }

    // ---- assignUnmatched ----

    @Test
    @DisplayName("assignUnmatched: updates thread + messages in one call")
    void assignUnmatched_happy() {
        UUID threadId  = UUID.randomUUID();
        UUID clientId  = UUID.randomUUID();
        var t = unmatchedThread("+48600100200", "SMS");
        t.setId(threadId);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));
        when(threads.save(any())).thenReturn(t);

        mutSvc.assignUnmatched(threadId, clientId, actor);

        assertThat(t.getClientId()).isEqualTo(clientId);
        assertThat(t.getRawSender()).isNull();
        verify(messages).bulkUpdateClientIdByThreadId(threadId, clientId);
        verify(threads).save(t);
    }

    @Test
    @DisplayName("assignUnmatched: throws 409 when thread already has clientId")
    void assignUnmatched_alreadyAssigned() {
        UUID threadId = UUID.randomUUID();
        var t = thread(UUID.randomUUID(), "EMAIL");
        t.setId(threadId);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));

        assertThatThrownBy(() -> mutSvc.assignUnmatched(threadId, UUID.randomUUID(), actor))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409");
    }

    // ---- discardUnmatched ----

    @Test
    @DisplayName("discardUnmatched: sets discardedAt")
    void discardUnmatched_happy() {
        UUID threadId = UUID.randomUUID();
        var t = unmatchedThread("+48123456789", "SMS");
        t.setId(threadId);
        when(threads.findById(threadId)).thenReturn(Optional.of(t));
        when(threads.save(any())).thenReturn(t);

        mutSvc.discardUnmatched(threadId, actor);

        assertThat(t.getDiscardedAt()).isNotNull();
        verify(threads).save(t);
    }

    @Test
    @DisplayName("discardUnmatched: throws 409 when already discarded")
    void discardUnmatched_alreadyDiscarded() {
        UUID threadId = UUID.randomUUID();
        var t = unmatchedThread("+48123456789", "SMS");
        t.setId(threadId);
        t.setDiscardedAt(OffsetDateTime.now());
        when(threads.findById(threadId)).thenReturn(Optional.of(t));

        assertThatThrownBy(() -> mutSvc.discardUnmatched(threadId, actor))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("409");
    }

    // ---- helpers ----

    private MessageThreadEntity thread(UUID clientId, String channel) {
        var t = new MessageThreadEntity();
        t.setId(UUID.randomUUID());
        t.setClientId(clientId);
        t.setChannel(channel);
        t.setUnreadCount(0);
        return t;
    }

    private MessageThreadEntity unmatchedThread(String rawSender, String channel) {
        var t = new MessageThreadEntity();
        t.setId(UUID.randomUUID());
        t.setRawSender(rawSender);
        t.setChannel(channel);
        t.setUnreadCount(0);
        return t;
    }
}
