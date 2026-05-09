package com.drshoes.app.messaging.service;

import com.drshoes.app.client.domain.Client;
import com.drshoes.app.client.domain.ClientRepository;
import com.drshoes.app.messaging.domain.MessageEntity;
import com.drshoes.app.messaging.domain.MessageThreadEntity;
import com.drshoes.app.messaging.dto.PostmarkInboundPayload;
import com.drshoes.app.messaging.dto.SmsApiInboundPayload;
import com.drshoes.app.messaging.repository.MessageRepository;
import com.drshoes.app.messaging.repository.MessageThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class InboundMessageServiceTest {

    private MessageRepository messageRepo;
    private MessageThreadRepository threadRepo;
    private ClientRepository clientRepo;
    private MessageThreadService threadService;
    private InboundMessageService sut;

    @BeforeEach
    void setUp() {
        messageRepo   = mock(MessageRepository.class);
        threadRepo    = mock(MessageThreadRepository.class);
        clientRepo    = mock(ClientRepository.class);
        threadService = mock(MessageThreadService.class);
        sut = new InboundMessageService(messageRepo, threadRepo, clientRepo, threadService);
    }

    // --- helpers ---

    private MessageThreadEntity stubThread(UUID threadId) {
        var t = new MessageThreadEntity();
        t.setId(threadId);
        t.setUnreadCount(0);
        return t;
    }

    private MessageEntity stubSavedMessage(UUID msgId, UUID threadId) {
        var m = MessageEntity.newMessage();
        m.setId(msgId);
        m.setThreadId(threadId);
        return m;
    }

    private Client stubClient(UUID clientId, String email, String phone) {
        var c = new Client();
        c.setId(clientId);
        c.setFirstName("Jan");
        c.setLastName("Kowalski");
        c.setEmail(email);
        c.setPhone(phone);
        return c;
    }

    private PostmarkInboundPayload emailPayload(String from, String msgId) {
        return new PostmarkInboundPayload(msgId, from, null, null, "Temat", "body text", null, null);
    }

    private SmsApiInboundPayload smsPayload(String smsId, String from) {
        return new SmsApiInboundPayload(smsId, from, "SMS body", 1715000000L);
    }

    // --- tests ---

    @Test
    void email_matched_clientFound_routesAndInserts() {
        var clientId = UUID.randomUUID();
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var client   = stubClient(clientId, "jan@example.com", "+48506220119");
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-001", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("jan@example.com")).thenReturn(Optional.of(client));
        when(threadService.findOrCreateForClient(clientId, "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        var result = sut.recordEmailInbound(emailPayload("jan@example.com", "pm-001"));

        assertThat(result.duplicate()).isFalse();
        assertThat(result.unmatched()).isFalse();
        assertThat(result.threadId()).isEqualTo(threadId);
        assertThat(result.messageId()).isEqualTo(msgId);
        verify(messageRepo).save(any(MessageEntity.class));
    }

    @Test
    void email_unmatched_rawSenderThread() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-002", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("unknown@example.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        var result = sut.recordEmailInbound(emailPayload("unknown@example.com", "pm-002"));

        assertThat(result.unmatched()).isTrue();
        assertThat(result.duplicate()).isFalse();
        verify(threadService).findOrCreateForRawSender("unknown@example.com", "EMAIL");
        verify(messageRepo).save(argThat(m -> m.getClientId() == null && "unknown@example.com".equals(m.getRawSender())));
    }

    @Test
    void sms_matched_phoneNormalized() {
        var clientId = UUID.randomUUID();
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var client   = stubClient(clientId, "jan@example.com", "+48506220119");
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-001", "SMS")).thenReturn(Optional.empty());
        when(clientRepo.findByPhone("+48506220119")).thenReturn(Optional.of(client));
        when(threadService.findOrCreateForClient(clientId, "SMS")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        // raw form "506 220 119" must normalize to "+48506220119"
        var result = sut.recordSmsInbound(smsPayload("sms-001", "506 220 119"));

        assertThat(result.unmatched()).isFalse();
        assertThat(result.duplicate()).isFalse();
        verify(clientRepo).findByPhone("+48506220119");
        verify(threadService).findOrCreateForClient(clientId, "SMS");
    }

    @Test
    void sms_unmatched() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-002", "SMS")).thenReturn(Optional.empty());
        when(clientRepo.findByPhone("+48999000111")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("+48999000111", "SMS")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        var result = sut.recordSmsInbound(smsPayload("sms-002", "+48999000111"));

        assertThat(result.unmatched()).isTrue();
        verify(threadService).findOrCreateForRawSender("+48999000111", "SMS");
        verify(messageRepo).save(argThat(m -> m.getClientId() == null));
    }

    @Test
    void idempotency_emailDuplicate_noInsert() {
        var existingMsgId  = UUID.randomUUID();
        var existingThread = UUID.randomUUID();
        var existing = stubSavedMessage(existingMsgId, existingThread);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-dup", "EMAIL"))
            .thenReturn(Optional.of(existing));

        var result = sut.recordEmailInbound(emailPayload("any@example.com", "pm-dup"));

        assertThat(result.duplicate()).isTrue();
        assertThat(result.messageId()).isEqualTo(existingMsgId);
        assertThat(result.threadId()).isEqualTo(existingThread);
        verify(messageRepo, never()).save(any());
        verify(threadRepo,  never()).save(any());
    }

    @Test
    void idempotency_smsDuplicate_noInsert() {
        var existingMsgId  = UUID.randomUUID();
        var existingThread = UUID.randomUUID();
        var existing = stubSavedMessage(existingMsgId, existingThread);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-dup", "SMS"))
            .thenReturn(Optional.of(existing));

        var result = sut.recordSmsInbound(smsPayload("sms-dup", "+48999000000"));

        assertThat(result.duplicate()).isTrue();
        assertThat(result.messageId()).isEqualTo(existingMsgId);
        verify(messageRepo, never()).save(any());
        verify(threadRepo,  never()).save(any());
    }

    @Test
    void email_strippedReplyEmpty_fallsBackToTextBody() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);
        var payload  = new PostmarkInboundPayload("pm-003", "a@b.com", null, null, "Subj", "fallback body", "", null);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-003", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        sut.recordEmailInbound(payload);

        verify(messageRepo).save(argThat(m -> "fallback body".equals(m.getBody())));
    }

    @Test
    void email_strippedReplyPresent_overridesTextBody() {
        var threadId = UUID.randomUUID();
        var msgId    = UUID.randomUUID();
        var thread   = stubThread(threadId);
        var payload  = new PostmarkInboundPayload("pm-004", "a@b.com", null, null, "Subj", "full body", "quoted reply only", null);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-004", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(msgId, threadId));

        sut.recordEmailInbound(payload);

        verify(messageRepo).save(argThat(m -> "quoted reply only".equals(m.getBody())));
    }

    @Test
    void email_subjectCarriedToThread() {
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-005", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        var payload = new PostmarkInboundPayload("pm-005", "a@b.com", null, null, "Pilna sprawa!", "body", null, null);
        sut.recordEmailInbound(payload);

        verify(threadRepo).save(argThat(t -> "Pilna sprawa!".equals(t.getSubject())));
    }

    @Test
    void sms_subjectNotCarried() {
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("sms-003", "SMS")).thenReturn(Optional.empty());
        when(clientRepo.findByPhone("+48506220119")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("+48506220119", "SMS")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        sut.recordSmsInbound(smsPayload("sms-003", "+48506220119"));

        // SMS has no subject — message.subject must be null
        verify(messageRepo).save(argThat(m -> m.getSubject() == null));
    }

    @Test
    void email_recipientLookupCaseInsensitive() {
        // verifies that the service calls findByEmailIgnoreCase (not findByEmail)
        // so that "JAN@EXAMPLE.COM" from Postmark header matches "jan@example.com" in DB
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);

        when(messageRepo.findByProviderMessageIdAndChannel("pm-006", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("JAN@EXAMPLE.COM")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("JAN@EXAMPLE.COM", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        var payload = new PostmarkInboundPayload("pm-006", "JAN@EXAMPLE.COM", null, null, "Subj", "body", null, null);
        sut.recordEmailInbound(payload);

        verify(clientRepo).findByEmailIgnoreCase("JAN@EXAMPLE.COM");
        verify(clientRepo, never()).findByEmailIgnoreCase(eq("jan@example.com"));
    }

    @Test
    void email_unreadIncrementsBy1() {
        var threadId = UUID.randomUUID();
        var thread   = stubThread(threadId);
        thread.setUnreadCount(3); // pre-existing unread count

        when(messageRepo.findByProviderMessageIdAndChannel("pm-007", "EMAIL")).thenReturn(Optional.empty());
        when(clientRepo.findByEmailIgnoreCase("a@b.com")).thenReturn(Optional.empty());
        when(threadService.findOrCreateForRawSender("a@b.com", "EMAIL")).thenReturn(thread);
        when(threadRepo.save(any())).thenReturn(thread);
        when(messageRepo.save(any())).thenReturn(stubSavedMessage(UUID.randomUUID(), threadId));

        sut.recordEmailInbound(emailPayload("a@b.com", "pm-007"));

        verify(threadRepo).save(argThat(t -> t.getUnreadCount() == 4));
    }
}
