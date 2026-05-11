package com.drshoes.lib.messaging;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Utility for privacy-safe recipient log tokens.
 *
 * <p>Contract: {@link #hashFirst8Hex(String)} returns the first 8 lowercase hex characters of the
 * SHA-256 digest of the UTF-8–encoded input string (32-bit prefix of a 256-bit hash).
 * This is sufficient to correlate log entries for the same recipient without logging raw
 * phone numbers or email addresses.</p>
 *
 * <p>Used by logging gateway implementations (e.g. {@code LoggingWhatsAppGateway},
 * {@code MessagingSpanHelper}) wherever a recipient identifier must appear in structured
 * log output or tracing spans.</p>
 */
public final class RecipientHashUtil {

    private RecipientHashUtil() { /* utility class */ }

    /**
     * Returns the first 8 lowercase hex characters of the SHA-256 digest of {@code recipient}.
     *
     * @param recipient raw phone number or email address; must not be null
     * @return 8-character lowercase hex string, or {@code "00000000"} if SHA-256 is unavailable
     */
    public static String hashFirst8Hex(String recipient) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(recipient.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 8);
        } catch (NoSuchAlgorithmException e) {
            return "00000000"; // SHA-256 is always available on JVM — defensive fallback only
        }
    }
}
