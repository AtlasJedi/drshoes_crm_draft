package com.drshoes.lib.email.smtp;

import com.drshoes.lib.messaging.Channel;
import com.drshoes.lib.messaging.OutboundMessage;
import com.drshoes.lib.storage.BlobStorage;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit test for SmtpEmailGateway — no Spring context, no real SMTP.
 *
 * Asserts that:
 *  1. When OutboundMessage.bodyHtml is non-null, the sent MimeMessage has both
 *     a text/plain part AND a text/html part (multipart/alternative contract).
 *  2. When OutboundMessage.bodyHtml is null, only a text/plain part is sent
 *     (no text/html part present anywhere in the MIME tree).
 *  3. From / To / Subject headers are set correctly in both cases.
 */
@ExtendWith(MockitoExtension.class)
class SmtpEmailGatewayTest {

    @Mock JavaMailSender sender;
    @Mock BlobStorage blobStorage;

    private SmtpEmailGateway gateway;

    @BeforeEach
    void setUp() {
        SmtpProperties props = new SmtpProperties();
        props.setFrom("no-reply@drshoes.local");
        props.setFromName("Dr Shoes");
        gateway = new SmtpEmailGateway(sender, props, blobStorage);
    }

    // ── Test 1: multipart/alternative when bodyHtml is non-null ─────────────

    @Test
    void whenBodyHtmlPresent_sentMimeMessageHasBothPlainAndHtmlParts() throws Exception {
        MimeMessage mime = realMimeMessage();
        when(sender.createMimeMessage()).thenReturn(mime);

        String plainText = "Twoje buty są gotowe. Przyjdź po odbiór.";
        String htmlBody  = "<table role=\"presentation\"><tr><td>Gotowe.</td></tr></table>";

        var msg = new OutboundMessage(
                Channel.EMAIL,
                "jan@example.com",
                "Gotowe do odbioru · DR-0001",
                plainText,
                List.of(),
                "idem-html-1",
                htmlBody);

        var receipt = gateway.send(msg);

        // Gateway must invoke sender.send(mime) exactly once
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        MimeMessage sent = captor.getValue();

        // From / To / Subject
        assertThat(sent.getFrom())
                .extracting(a -> ((InternetAddress) a).getAddress())
                .containsExactly("no-reply@drshoes.local");
        assertThat(sent.getRecipients(Message.RecipientType.TO))
                .extracting(a -> ((InternetAddress) a).getAddress())
                .containsExactly("jan@example.com");
        assertThat(sent.getSubject()).isEqualTo("Gotowe do odbioru · DR-0001");

        // Collect all leaf content-type strings from the full MIME tree
        List<String> leafContentTypes = collectLeafContentTypes(sent);

        assertThat(leafContentTypes)
                .as("text/plain part must be present when bodyHtml is non-null; found parts: " + leafContentTypes)
                .anyMatch(ct -> ct.toLowerCase().startsWith("text/plain"));

        assertThat(leafContentTypes)
                .as("text/html part must be present when bodyHtml is non-null; found parts: " + leafContentTypes)
                .anyMatch(ct -> ct.toLowerCase().startsWith("text/html"));

        assertThat(receipt.providerMessageId()).startsWith("smtp-");
    }

    // ── Test 2: plain-text only when bodyHtml is null ───────────────────────

    @Test
    void whenBodyHtmlAbsent_sentMimeMessageHasOnlyPlainTextPart() throws Exception {
        MimeMessage mime = realMimeMessage();
        when(sender.createMimeMessage()).thenReturn(mime);

        var msg = OutboundMessage.of(
                Channel.EMAIL,
                "jan@example.com",
                "Zlecenie przyjęte · DR-0002",
                "Twoje zlecenie zostało przyjęte.",
                List.of(),
                "idem-plain-1");

        gateway.send(msg);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(captor.capture());
        MimeMessage sent = captor.getValue();

        List<String> leafContentTypes = collectLeafContentTypes(sent);

        assertThat(leafContentTypes)
                .as("text/plain part must be present; found parts: " + leafContentTypes)
                .anyMatch(ct -> ct.toLowerCase().startsWith("text/plain"));

        assertThat(leafContentTypes)
                .as("text/html part must NOT be present when bodyHtml is null; found parts: " + leafContentTypes)
                .noneMatch(ct -> ct.toLowerCase().startsWith("text/html"));

        // From / To / Subject sanity check
        assertThat(sent.getFrom())
                .extracting(a -> ((InternetAddress) a).getAddress())
                .containsExactly("no-reply@drshoes.local");
        assertThat(sent.getRecipients(Message.RecipientType.TO))
                .extracting(a -> ((InternetAddress) a).getAddress())
                .containsExactly("jan@example.com");
        assertThat(sent.getSubject()).isEqualTo("Zlecenie przyjęte · DR-0002");
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Creates a real MimeMessage backed by a no-op Session so that
     * MimeMessageHelper can set headers, content type, body, etc.
     */
    private static MimeMessage realMimeMessage() {
        var session = jakarta.mail.Session.getInstance(new Properties());
        return new MimeMessage(session);
    }

    /**
     * Recursively collects the content-type strings of all leaf parts in the MIME tree.
     *
     * Uses {@link Part#isMimeType(String)} pattern rather than getContent() to avoid
     * eagerly decoding body bytes — important for reading parts that may contain
     * encoded binary or encoded text.
     *
     * A "leaf" is any part that is not itself a multipart.
     */
    private static List<String> collectLeafContentTypes(Part part) throws Exception {
        List<String> result = new ArrayList<>();
        collectLeafContentTypesInto(part, result);
        return result;
    }

    private static void collectLeafContentTypesInto(Part part, List<String> out) throws Exception {
        // Call saveChanges() on the root message before traversal to ensure
        // the MimeMessage's content-type header is finalized by MimeMessageHelper.
        if (part instanceof MimeMessage mm) {
            mm.saveChanges();
        }
        if (part.isMimeType("multipart/*")) {
            Object content = part.getContent();
            if (content instanceof Multipart mp) {
                for (int i = 0; i < mp.getCount(); i++) {
                    collectLeafContentTypesInto(mp.getBodyPart(i), out);
                }
            } else {
                // Unexpected — treat as leaf
                out.add(part.getContentType());
            }
        } else {
            out.add(part.getContentType());
        }
    }
}
