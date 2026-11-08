-- Runs once on a fresh volume. TypeORM (synchronize/migrations) owns the real schema;
-- keep this for extensions / sanity only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
