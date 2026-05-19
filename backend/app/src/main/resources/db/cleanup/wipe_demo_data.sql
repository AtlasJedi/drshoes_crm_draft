-- =============================================================================
-- wipe_demo_data.sql — Manual operator wipe for demo / dev environments
-- =============================================================================
-- PURPOSE
--   Clears all demo-generated rows so DemoSeedRunner can reseed from scratch.
--   Run via psql before restarting the app with drshoes.demo.seed.enabled=true.
--
-- USAGE
--   psql $DATABASE_URL -f wipe_demo_data.sql
--
-- WHAT IS TOUCHED
--   Transactional/domain tables (FK dependency order — children before parents):
--     message            → inbound/outbound messages in threads
--     message_thread     → per-client conversation threads
--     photo              → order photos
--     order_item         → line items on orders
--     order_             → orders themselves
--     audit_log          → audit trail entries
--     client_phone       → phone numbers belonging to clients
--     client             → client records
--
--   Sequence side-table (ALSO reset so codes start from DR-YYYY-0001 again):
--     order_code_counter → stores last_number per year; TRUNCATE resets to 0.
--                          Next seed run will re-populate from 0001 for the
--                          current year. NOTE: if the app ran and allocated
--                          codes for prior years, those rows are wiped too —
--                          that is intentional for a full demo reset.
--
-- WHAT IS NOT TOUCHED (intentionally preserved)
--   user_               → admin login accounts (seeded by V002, not demo data)
--   setting             → application settings
--   template            → email/SMS templates
--   trigger             → automation triggers
--   Any Flyway schema_version table
--
-- SAFETY
--   NOT auto-applied via Flyway. Operator-only tool. Never run on production.
-- =============================================================================

BEGIN;

TRUNCATE TABLE message              RESTART IDENTITY CASCADE;
TRUNCATE TABLE message_thread       RESTART IDENTITY CASCADE;
TRUNCATE TABLE photo                RESTART IDENTITY CASCADE;
TRUNCATE TABLE order_item           RESTART IDENTITY CASCADE;
TRUNCATE TABLE order_               RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_log            RESTART IDENTITY CASCADE;
TRUNCATE TABLE client_phone         RESTART IDENTITY CASCADE;
TRUNCATE TABLE client               RESTART IDENTITY CASCADE;

-- Reset the order code counter so the next seed starts from DR-YYYY-0001.
TRUNCATE TABLE order_code_counter   RESTART IDENTITY;

COMMIT;
