package com.drshoes.lib.email.smtp;

import com.drshoes.lib.email.EmailGateway;
import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.DeliveryReceipt;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.storage.BlobKey;
import com.drshoes.lib.storage.BlobStorage;
import jakarta.mail.internet.MimeMessage;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;

@Slf4j
@RequiredArgsConstructor
public class SmtpEmailGateway implements EmailGateway {

    private final JavaMailSender sender;
    private final SmtpProperties props;
    private final BlobStorage blobStorage;

    @Override public Channel channel() { return Channel.EMAIL; }

    @Override
    public DeliveryReceipt send(OutboundMessage m) {
        long start = System.currentTimeMillis();
        String providerId = "smtp-" + UUID.randomUUID();
        try {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
            h.setFrom(props.getFrom(), props.getFromName());
            h.setTo(m.recipient());
            h.setSubject(m.subject());
            if (m.bodyHtml() != null) {
                h.setText(m.body(), m.bodyHtml());
            } else {
                h.setText(m.body(), false);
            }
            mime.setHeader("Message-ID", "<" + providerId + "@drshoes.local>");
            for (var att : m.attachments()) {
                try (InputStream is = blobStorage.get(new BlobKey(att.storageKey()))) {
                    byte[] bytes = is.readAllBytes();
                    h.addAttachment(att.storageKey(), new ByteArrayResource(bytes), att.mime());
                }
            }
            sender.send(mime);
            long durationMs = System.currentTimeMillis() - start;
            log.info("op=smtp.send outcome=success providerMessageId={} idemKey={} recipientLast4={} subjectLen={} attachments={} durationMs={}",
                    providerId, m.idempotencyKey(), last4(m.recipient()), m.subject().length(), m.attachments().size(), durationMs);
            return DeliveryReceipt.accepted(providerId);
        } catch (MailException e) {
            log.warn("op=smtp.send outcome=failed errorCode=SMTP errorMessage={} idemKey={} recipientLast4={}",
                    e.getMessage(), m.idempotencyKey(), last4(m.recipient()));
            return DeliveryReceipt.failed("SMTP", e.getMessage());
        } catch (Exception e) {
            log.warn("op=smtp.send outcome=failed errorCode=UNEXPECTED errorMessage={} idemKey={} recipientLast4={}",
                    e.getMessage(), m.idempotencyKey(), last4(m.recipient()));
            return DeliveryReceipt.failed("UNEXPECTED", e.getMessage());
        }
    }

    private static String last4(String r) {
        if (r == null || r.length() < 4) return "****";
        return r.substring(r.length() - 4);
    }
}
