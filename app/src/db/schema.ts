import * as SQLite from 'expo-sqlite';

const DB_NAME = 'notatnik.db';
const SCHEMA_VERSION = 1;

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS notes (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'recorded',
  recorded_at     INTEGER NOT NULL,
  duration_ms     INTEGER,
  audio_uri       TEXT,
  summary         TEXT,
  blocks_json     TEXT,
  error_message   TEXT,
  audio_uploaded  INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id          TEXT PRIMARY KEY,
  note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  uri         TEXT NOT NULL,
  offset_ms   INTEGER NOT NULL,
  uploaded    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_note_id ON photos(note_id);
CREATE INDEX IF NOT EXISTS idx_notes_recorded_at ON notes(recorded_at DESC);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) {
    return;
  }

  if (current < 1) {
    // Wcześniejszy szkic miał inną tabelę notes + osobne audio.
    // user_version = 0 oznacza: schemat niezgodny z kontraktem Kroku 1.
    await db.execAsync(`
      DROP TABLE IF EXISTS audio;
      DROP TABLE IF EXISTS photos;
      DROP TABLE IF EXISTS notes;
      ${CREATE_TABLES}
      PRAGMA user_version = 1;
    `);
  }
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
