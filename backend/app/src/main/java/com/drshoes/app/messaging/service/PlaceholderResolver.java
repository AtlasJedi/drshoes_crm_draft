package com.drshoes.app.messaging.service;

import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class PlaceholderResolver {

  private static final DateTimeFormatter PL =
      DateTimeFormatter.ofPattern("dd.MM.yyyy 'o' HH:mm", Locale.forLanguageTag("pl"))
          .withZone(ZoneId.of("Europe/Warsaw"));

  private final Map<String, Function<TemplateContext, String>> strategies = new HashMap<>();

  public PlaceholderResolver() {
    strategies.put("imie_klienta",    ctx -> blankToDash(ctx.imieKlienta()));
    strategies.put("numer_zlecenia",  ctx -> blankToDash(ctx.numerZlecenia()));
    strategies.put("typ_pracy",       ctx -> ctx.typyPracy() == null || ctx.typyPracy().isEmpty()
                                             ? "—"
                                             : String.join(", ", ctx.typyPracy()));
    strategies.put("data_odbioru",    ctx -> ctx.dataOdbioru() == null ? "—" : PL.format(ctx.dataOdbioru()));
    strategies.put("nazwa_warsztatu", ctx -> blankToDash(ctx.nazwaWarsztatu()));
    strategies.put("adres_warsztatu", ctx -> blankToDash(ctx.adresWarsztatu()));
    strategies.put("godziny_otwarcia",ctx -> blankToDash(ctx.godzinyOtwarcia()));
    strategies.put("url_warsztatu",      ctx -> blankToDash(ctx.urlWarsztatu()));
    strategies.put("telefon_warsztatu", ctx -> blankToDash(ctx.telefonWarsztatu()));
    strategies.put("mapy_url",          ctx -> ctx.mapyUrl() != null && !ctx.mapyUrl().isBlank()
                                               ? ctx.mapyUrl() : "https://www.google.com/");
    strategies.put("link_do_zdjec",   ctx -> {
      log.warn("op=template.render placeholder=link_do_zdjec reason=deferred_until_M3");
      return "—";
    });
    // v2-E: operator free-form body injected into the followup email wrapper
    strategies.put("wiadomosc_tresc", ctx -> ctx.wiadomoscTresc() != null ? ctx.wiadomoscTresc() : "");
  }

  /** Returns substitution for the placeholder name (no braces) or null if unknown. */
  public String resolve(String name, TemplateContext ctx) {
    var fn = strategies.get(name);
    return fn == null ? null : fn.apply(ctx);
  }

  private static String blankToDash(String s) { return (s == null || s.isBlank()) ? "—" : s; }
}
