package com.drshoes.app.messaging.util;

/**
 * Normalizes phone numbers to E.164 format with Polish country code fallback.
 * Strips spaces, parentheses, and dashes; converts 00-prefix to +; prepends +48
 * for bare 9-digit or 11-digit 48-prefixed numbers.
 *
 * Returns null for null or empty-after-stripping input.
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    public static String normalize(String raw) {
        if (raw == null) return null;
        var digits = raw.replaceAll("[^0-9+]", "");
        if (digits.startsWith("00")) digits = "+" + digits.substring(2);
        if (digits.startsWith("+")) return digits;
        if (digits.length() == 11 && digits.startsWith("48")) return "+" + digits;
        if (digits.length() == 9) return "+48" + digits;
        return digits.isEmpty() ? null : "+" + digits;
    }
}
