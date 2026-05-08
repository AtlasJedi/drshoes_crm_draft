package com.drshoes.app.messaging.service;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateRendererTest {

  private final TemplateRenderer renderer = new TemplateRenderer(new PlaceholderResolver());

  @Test
  void substitutesAllSupportedPlaceholders() {
    var ctx = new TemplateContext(
        "Anna",                                      // imie_klienta
        "DR-2026-0001",                              // numer_zlecenia
        List.of("naprawa", "custom buty"),           // typ_pracy raw labels
        OffsetDateTime.of(2026, 5, 9, 10, 30, 0, 0, ZoneOffset.of("+02:00")),
        "Dr Shoes"
    );
    String body = "Czesc {imie_klienta}, zlecenie {numer_zlecenia} ({typ_pracy}). Odbior: {data_odbioru}. {nazwa_warsztatu}";

    String rendered = renderer.render(body, ctx);

    assertThat(rendered).isEqualTo(
        "Czesc Anna, zlecenie DR-2026-0001 (naprawa, custom buty). Odbior: 09.05.2026 o 10:30. Dr Shoes");
  }

  @Test
  void missingPlannedPickupRendersEmDash() {
    var ctx = new TemplateContext("Anna", "DR-2026-0002", List.of(), null, "Dr Shoes");
    assertThat(renderer.render("{data_odbioru}", ctx)).isEqualTo("—");
  }

  @Test
  void deferredLinkPlaceholderRendersEmDash() {
    var ctx = new TemplateContext("Anna", "DR-2026-0003", List.of(), null, "Dr Shoes");
    assertThat(renderer.render("Galeria: {link_do_zdjec}", ctx)).isEqualTo("Galeria: —");
  }

  @Test
  void unknownPlaceholderLeftIntact() {
    // Documents current behavior: only known placeholders are substituted; unknown left literal.
    var ctx = new TemplateContext("Anna", "DR-2026-0004", List.of(), null, "Dr Shoes");
    assertThat(renderer.render("Hello {nonsense}", ctx)).isEqualTo("Hello {nonsense}");
  }
}
