-- =============================================================================
-- V002 — Seed dev users
-- Password for both: "change-me-on-first-login"
-- Hashes generated via BCryptPasswordEncoder(12).encode("change-me-on-first-login").
-- Each row has a unique BCrypt salt (different hashes despite same plaintext).
-- These accounts are for LOCAL DEV ONLY. Change passwords on first login in any
-- non-local environment.
-- =============================================================================

INSERT INTO user_ (id, email, password_hash, full_name, role, active, created_at, updated_at)
VALUES
  (
    uuid_generate_v4(),
    'misza@drshoes.pl',
    '$2a$12$DNYoPZBbMSKmPIXo276oYu/1XHp8EmNcMTfCuRjrz0BSXb9FNtB3C',
    'Misza Doctor',
    'OWNER',
    TRUE,
    now(),
    now()
  ),
  (
    uuid_generate_v4(),
    'pomocnik@drshoes.pl',
    '$2a$12$8nlvoYW05lL0kkfY8gmPl.ogFRA1E4ABVhDTWwKA37p27EVqHVWVW',
    'Pomocnik',
    'EMPLOYEE',
    TRUE,
    now(),
    now()
  )
ON CONFLICT (email) DO NOTHING;
