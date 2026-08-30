import * as SQLite from 'expo-sqlite';

// ============================================================================
// Schema SQLite - offline-first źródło prawdy.
// Wszystkie pliki lokalne zapisywane są w Documents/, NIGDY w Cache/.
// ============================================================================

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  summary       TEXT,
  latitude      REAL,
  longitude     REAL,
  location_name TEXT,
  recorded_at   INTEGER NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'done',
  sync_status   TEXT NOT NULL DEFAULT 'pending',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id         TEXT PRIMARY KEY,
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  local_uri  TEXT NOT NULL,
  caption    TEXT,
  offset_ms  INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audio (
  id          TEXT PRIMARY KEY,
  note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  local_uri   TEXT NOT NULL,
  duration_ms INTEGER,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_note_id ON photos(note_id);
CREATE INDEX IF NOT EXISTS idx_audio_note_id ON audio(note_id);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('notatnik.db').then(async (db) => {
      await db.execAsync(SCHEMA);
      return db;
    });
  }
  return dbPromise;
}
