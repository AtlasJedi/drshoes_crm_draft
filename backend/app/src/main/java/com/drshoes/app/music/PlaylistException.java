package com.drshoes.app.music;

/**
 * Domain exception for playlist CRUD errors.
 * The {@code code} is returned verbatim in the JSON {@code {error: code}} response body.
 */
public class PlaylistException extends RuntimeException {

    public static final String NOT_FOUND      = "playlist_not_found";
    public static final String DUPLICATE_NAME = "duplicate_name";
    public static final String INVALID_NAME   = "invalid_name";
    public static final String INVALID_ORDER  = "invalid_order";
    public static final String TRACK_NOT_FOUND = "track_not_found";

    private final String code;

    public PlaylistException(String code) {
        super(code);
        this.code = code;
    }

    public PlaylistException(String code, String detail) {
        super(code + ": " + detail);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
