package com.drshoes.app.messaging.service;

import java.time.OffsetDateTime;
import java.util.List;

public record TemplateContext(
    String imieKlienta,
    String numerZlecenia,
    List<String> typyPracy,         // raw kind labels in PL, joined by renderer
    OffsetDateTime dataOdbioru,     // nullable
    String nazwaWarsztatu
) {}
