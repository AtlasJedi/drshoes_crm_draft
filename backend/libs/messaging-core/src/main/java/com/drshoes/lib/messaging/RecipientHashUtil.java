package com.drshoes.lib.messaging;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
public final class RecipientHashUtil {

    private RecipientHashUtil() { /* utility class */ }
    public static String hashFirst8Hex(String recipient) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(recipient.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 8);
        } catch (NoSuchAlgorithmException e) {
            return "00000000";
        }
    }
}
