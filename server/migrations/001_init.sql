-- ============================================================================
-- Notatnik Terenowy - baza danych
-- Źródło prawdy offline: SQLite na urządzeniu (id UUID generowane na telefonie).
-- Backend (Postgres) pełni rolę synchronicznej kopii - upsert idempotentny.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Notatki terenowe
CREATE TABLE IF NOT EXISTS notes (
  id            UUID PRIMARY KEY,                          -- ID generowane na telefonie
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  summary       TEXT,                                      -- podsumowanie LLM (backend)
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  location_name TEXT,
  recorded_at   TIMESTAMPTZ NOT NULL,                      -- moment nagrania (offline)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zdjęcia przypisane do notatki (relacja 1:N)
CREATE TABLE IF NOT EXISTS photos (
  id            UUID PRIMARY KEY,                          -- ID generowane na telefonie
  note_id       UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  object_key    TEXT NOT NULL,                             -- klucz w MinIO (S3)
  url           TEXT,
  offset_ms     BIGINT NOT NULL DEFAULT 0,                 -- offset względem nagrania audio
  caption       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_note_id ON photos(note_id);

-- Pliki audio (jeden na notatkę)
CREATE TABLE IF NOT EXISTS audio (
  id            UUID PRIMARY KEY,                          -- ID generowane na telefonie
  note_id       UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  object_key    TEXT NOT NULL,
  url           TEXT,
  duration_ms   BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_note_id ON audio(note_id);

-- ============================================================================
-- Migracje (śledzenie wersji schematu)
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_init')
ON CONFLICT (version) DO NOTHING;
