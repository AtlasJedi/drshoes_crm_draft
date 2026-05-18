package com.drshoes.app.music;

/**
 * Failure inside YouTube search. {@code code} maps directly to the JSON
 * {@code error} field returned by {@link MusicController}.
 */
public class MusicSearchException extends RuntimeException {
    public static final String CODE_DISABLED = "music_disabled";
    public static final String CODE_FAILED = "music_search_failed";

    private final String code;

    public MusicSearchException(String code, String message) {
        super(message);
        this.code = code;
    }

    public MusicSearchException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
