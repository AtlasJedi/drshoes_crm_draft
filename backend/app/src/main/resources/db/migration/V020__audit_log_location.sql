-- M10 wave 1: capture location change in audit row for ORDER_NOTE events.
-- Both nullable — notes without location move set both NULL; moves set both
-- (or only locationTo when previous was NULL).
ALTER TABLE audit_log ADD COLUMN location_from VARCHAR(64) NULL;
ALTER TABLE audit_log ADD COLUMN location_to   VARCHAR(64) NULL;
