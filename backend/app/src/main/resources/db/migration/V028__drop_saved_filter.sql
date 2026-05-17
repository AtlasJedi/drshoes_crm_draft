-- v2-fixes: rip the "+ zapisz widok" feature.
-- The saved_filter table was created in V001 but never wired to any controller
-- or service; UI had a disabled chip ("wkrótce"). Owner directive 2026-05-17:
-- delete entirely, table is dead weight.
DROP TABLE IF EXISTS saved_filter;
