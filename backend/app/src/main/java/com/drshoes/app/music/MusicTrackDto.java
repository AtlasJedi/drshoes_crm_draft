package com.drshoes.app.music;

/** Single track returned to the admin music UI. */
public record MusicTrackDto(
    String videoId,
    String title,
    String channelTitle,
    String thumbnailUrl
) {}
