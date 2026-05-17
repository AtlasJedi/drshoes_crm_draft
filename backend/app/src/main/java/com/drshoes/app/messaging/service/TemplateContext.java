package com.drshoes.app.messaging.service;

import java.time.OffsetDateTime;
import java.util.List;

public record TemplateContext(
    String imieKlienta,
    String numerZlecenia,
    List<String> typyPracy,         // raw kind labels in PL, joined by renderer
    OffsetDateTime dataOdbioru,     // nullable
    String nazwaWarsztatu,
    String adresWarsztatu,          // nullable — from WorkshopProperties
    String godzinyOtwarcia,         // nullable — from WorkshopProperties
    String urlWarsztatu,            // nullable — from WorkshopProperties
    String wiadomoscTresc,          // nullable — operator typed body (v2-E followup)
    String telefonWarsztatu,        // nullable — from WorkshopProperties.phone
    String mapyUrl                  // nullable — Google Maps directions deeplink
) {
    /** Convenience constructor without wiadomoscTresc (backwards compat). */
    public TemplateContext(String imieKlienta, String numerZlecenia, List<String> typyPracy,
                           OffsetDateTime dataOdbioru, String nazwaWarsztatu,
                           String adresWarsztatu, String godzinyOtwarcia, String urlWarsztatu) {
        this(imieKlienta, numerZlecenia, typyPracy, dataOdbioru, nazwaWarsztatu,
             adresWarsztatu, godzinyOtwarcia, urlWarsztatu, null, null, null);
    }

    /** Convenience constructor with wiadomoscTresc but without phone/maps (backwards compat). */
    public TemplateContext(String imieKlienta, String numerZlecenia, List<String> typyPracy,
                           OffsetDateTime dataOdbioru, String nazwaWarsztatu,
                           String adresWarsztatu, String godzinyOtwarcia, String urlWarsztatu,
                           String wiadomoscTresc) {
        this(imieKlienta, numerZlecenia, typyPracy, dataOdbioru, nazwaWarsztatu,
             adresWarsztatu, godzinyOtwarcia, urlWarsztatu, wiadomoscTresc, null, null);
    }
}
