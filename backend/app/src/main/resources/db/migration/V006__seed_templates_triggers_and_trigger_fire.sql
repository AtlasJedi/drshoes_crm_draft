-- =============================================================================
-- M2: Messaging + Triggers
-- Seeds 4 templates + 4 triggers; creates trigger_fire dedup table.
-- =============================================================================

-- ---- TEMPLATES (4 seeds) ----
INSERT INTO message_template (id, name, channel, subject, body, active)
VALUES
  (uuid_generate_v4(), 'Zlecenie przyjete (EMAIL)', 'EMAIL',
   'Twoje zlecenie {numer_zlecenia} zostalo przyjete',
   E'Czesc {imie_klienta},\n\nDziekujemy! Przyjelismy Twoje zlecenie {numer_zlecenia} ({typ_pracy}).\nPlanowany odbior: {data_odbioru}.\n\nPozdrawiamy,\n{nazwa_warsztatu}',
   TRUE),
  (uuid_generate_v4(), 'Gotowe do odbioru (EMAIL)', 'EMAIL',
   'Zlecenie {numer_zlecenia} gotowe do odbioru',
   E'Czesc {imie_klienta},\n\nTwoje zlecenie {numer_zlecenia} jest gotowe do odbioru.\nZapraszamy w godzinach pracy warsztatu.\n\n{nazwa_warsztatu}',
   TRUE),
  (uuid_generate_v4(), 'Przypomnienie o odbiorze (SMS)', 'SMS',
   NULL,
   '{imie_klienta}, jutro mozesz odebrac zlecenie {numer_zlecenia}. {nazwa_warsztatu}',
   TRUE),
  (uuid_generate_v4(), 'Prosba o opinie (EMAIL)', 'EMAIL',
   'Jak oceniasz nasza prace?',
   E'Czesc {imie_klienta},\n\nMinely 3 dni od odebrania zlecenia {numer_zlecenia}. Bedziemy wdzieczni za krotka opinie.\n\n{nazwa_warsztatu}',
   TRUE);

-- ---- TRIGGERS (4 seeds, all enabled) ----
-- Each trigger references its template by name (resolved via subselect).
INSERT INTO trigger_ (id, name, enabled, event, event_params, channels, template_id, delay_minutes, requires_manual_confirmation)
VALUES
  (uuid_generate_v4(), 'Zlecenie przyjete', TRUE,
   'STATUS_CHANGE', '{"toStatus":"PRZYJETE"}'::jsonb, '["EMAIL"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Zlecenie przyjete (EMAIL)'),
   0, FALSE),
  (uuid_generate_v4(), 'Gotowe do odbioru', TRUE,
   'STATUS_CHANGE', '{"toStatus":"GOTOWE_DO_ODBIORU"}'::jsonb, '["EMAIL"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Gotowe do odbioru (EMAIL)'),
   0, FALSE),
  (uuid_generate_v4(), 'Przypomnienie o odbiorze', TRUE,
   'BEFORE_PICKUP_X_DAYS', '{"days":1,"atTime":"09:00"}'::jsonb, '["SMS"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Przypomnienie o odbiorze (SMS)'),
   0, FALSE),
  (uuid_generate_v4(), 'Prosba o opinie', TRUE,
   'AFTER_HANDOVER_Y_DAYS', '{"days":3,"atTime":"11:00"}'::jsonb, '["EMAIL"]'::jsonb,
   (SELECT id FROM message_template WHERE name = 'Prosba o opinie (EMAIL)'),
   0, FALSE);

-- ---- TRIGGER_FIRE dedup table ----
CREATE TABLE trigger_fire (
  trigger_id    UUID NOT NULL REFERENCES trigger_(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
  discriminator VARCHAR(120) NOT NULL,
  fired_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trigger_id, order_id, discriminator)
);
CREATE INDEX trigger_fire_order_idx ON trigger_fire (order_id, fired_at DESC);
