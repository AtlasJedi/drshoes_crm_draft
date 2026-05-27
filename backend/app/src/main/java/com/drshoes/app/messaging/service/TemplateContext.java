package com.drshoes.app.messaging.service;

import java.time.OffsetDateTime;
import java.util.List;

public record TemplateContext(
    String imieKlienta,
    String numerZlecenia,
    List<String> typyPracy,
    OffsetDateTime dataOdbioru,
    String nazwaWarsztatu,
    String adresWarsztatu,
    String godzinyOtwarcia,
    String urlWarsztatu,
    String wiadomoscTresc,
    String telefonWarsztatu,
    String mapyUrl
) {
    public TemplateContext(String imieKlienta, String numerZlecenia, List<String> typyPracy,
                           OffsetDateTime dataOdbioru, String nazwaWarsztatu,
                           String adresWarsztatu, String godzinyOtwarcia, String urlWarsztatu) {
        this(imieKlienta, numerZlecenia, typyPracy, dataOdbioru, nazwaWarsztatu,
             adresWarsztatu, godzinyOtwarcia, urlWarsztatu, null, null, null);
    }
    public TemplateContext(String imieKlienta, String numerZlecenia, List<String> typyPracy,
                           OffsetDateTime dataOdbioru, String nazwaWarsztatu,
                           String adresWarsztatu, String godzinyOtwarcia, String urlWarsztatu,
                           String wiadomoscTresc) {
        this(imieKlienta, numerZlecenia, typyPracy, dataOdbioru, nazwaWarsztatu,
             adresWarsztatu, godzinyOtwarcia, urlWarsztatu, wiadomoscTresc, null, null);
    }
}
