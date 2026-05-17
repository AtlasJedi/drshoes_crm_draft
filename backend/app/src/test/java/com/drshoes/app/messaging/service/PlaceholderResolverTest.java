package com.drshoes.app.messaging.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PlaceholderResolverTest {

    private final PlaceholderResolver resolver = new PlaceholderResolver();

    private static TemplateContext ctx(String adres, String godziny, String url) {
        return new TemplateContext(
                "Jan", "DR-001", List.of(), null, "Dr Shoes",
                adres, godziny, url);
    }

    private static TemplateContext ctxFull(String telefon, String mapyUrl) {
        return new TemplateContext(
                "Jan", "DR-001", List.of(), null, "Dr Shoes",
                null, null, null, null, telefon, mapyUrl);
    }

    @Test
    @DisplayName("adres_warsztatu returns value when set")
    void adresWarsztatu_returnsValue() {
        assertThat(resolver.resolve("adres_warsztatu", ctx("ul. Mostowa 5a", null, null)))
                .isEqualTo("ul. Mostowa 5a");
    }

    @Test
    @DisplayName("adres_warsztatu returns em-dash when null")
    void adresWarsztatu_nullReturnsEmDash() {
        assertThat(resolver.resolve("adres_warsztatu", ctx(null, null, null))).isEqualTo("—");
    }

    @Test
    @DisplayName("godziny_otwarcia returns value when set")
    void godzinyOtwarcia_returnsValue() {
        assertThat(resolver.resolve("godziny_otwarcia", ctx(null, "pon–pt 10:00–18:00", null)))
                .isEqualTo("pon–pt 10:00–18:00");
    }

    @Test
    @DisplayName("godziny_otwarcia returns em-dash when null")
    void godzinyOtwarcia_nullReturnsEmDash() {
        assertThat(resolver.resolve("godziny_otwarcia", ctx(null, null, null))).isEqualTo("—");
    }

    @Test
    @DisplayName("url_warsztatu returns value when set")
    void urlWarsztatu_returnsValue() {
        assertThat(resolver.resolve("url_warsztatu", ctx(null, null, "https://drshoes.pl")))
                .isEqualTo("https://drshoes.pl");
    }

    @Test
    @DisplayName("url_warsztatu returns em-dash when null")
    void urlWarsztatu_nullReturnsEmDash() {
        assertThat(resolver.resolve("url_warsztatu", ctx(null, null, null))).isEqualTo("—");
    }

    @Test
    @DisplayName("telefon_warsztatu returns value when set")
    void telefonWarsztatu_returnsValue() {
        assertThat(resolver.resolve("telefon_warsztatu", ctxFull("+48 514 296 809", null)))
                .isEqualTo("+48 514 296 809");
    }

    @Test
    @DisplayName("telefon_warsztatu returns em-dash when null")
    void telefonWarsztatu_nullReturnsEmDash() {
        assertThat(resolver.resolve("telefon_warsztatu", ctxFull(null, null))).isEqualTo("—");
    }

    @Test
    @DisplayName("mapy_url returns value when set")
    void mapyUrl_returnsValue() {
        String url = "https://www.google.com/maps/dir/?api=1&destination=Poznan";
        assertThat(resolver.resolve("mapy_url", ctxFull(null, url))).isEqualTo(url);
    }

    @Test
    @DisplayName("mapy_url returns fallback google.com when null")
    void mapyUrl_nullReturnsFallback() {
        assertThat(resolver.resolve("mapy_url", ctxFull(null, null)))
                .isEqualTo("https://www.google.com/");
    }

    @Test
    @DisplayName("unknown placeholder returns null")
    void unknownPlaceholder_returnsNull() {
        assertThat(resolver.resolve("xyz_nieznany", ctx(null, null, null))).isNull();
    }
}
