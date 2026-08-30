import { getDatabase } from './schema';
import type {
  DBNote,
  DBPhoto,
  DBAudio,
  NewNoteInput,
  NewPhotoInput,
  NewAudioInput,
} from './types';

// ============================================================================
// Repozytorium danych SQLite. Jedyna warstwa bezpośrednio komunikująca się z DB.
// Wszystkie operacje idempotentne (upsert) zgodnie z zasadą FAIL-SAFE.
// ============================================================================

export class NoteRepository {
  async createNote(input: NewNoteInput): Promise<DBNote> {
    const db = await getDatabase();
    const now = Date.now();
    const note: DBNote = {
      id: input.id,
      title: input.title,
      body: '',
      summary: null,
      latitude: input.latitude,
      longitude: input.longitude,
      locationName: input.locationName,
      recordedAt: input.recordedAt,
      recordStatus: 'done',
      syncStatus: 'pending',
      createdAt: input.recordedAt,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT OR REPLACE INTO notes
       (id, title, body, summary, latitude, longitude, location_name,
        recorded_at, record_status, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id,
        note.title,
        note.body,
        note.summary,
        note.latitude,
        note.longitude,
        note.locationName,
        note.recordedAt,
        note.recordStatus,
        note.syncStatus,
        note.createdAt,
        note.updatedAt,
      ],
    );

    return note;
  }

  async addPhoto(input: NewPhotoInput): Promise<DBPhoto> {
    const db = await getDatabase();
    const photo: DBPhoto = {
      id: input.id,
      noteId: input.noteId,
      localUri: input.localUri,
      caption: input.caption,
      offsetMs: input.offsetMs,
      syncStatus: 'pending',
      createdAt: Date.now(),
    };

    await db.runAsync(
      `INSERT OR REPLACE INTO photos
       (id, note_id, local_uri, caption, offset_ms, sync_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        photo.id,
        photo.noteId,
        photo.localUri,
        photo.caption,
        photo.offsetMs,
        photo.syncStatus,
        photo.createdAt,
      ],
    );

    return photo;
  }

  async addAudio(input: NewAudioInput): Promise<DBAudio> {
    const db = await getDatabase();
    const audio: DBAudio = {
      id: input.id,
      noteId: input.noteId,
      localUri: input.localUri,
      durationMs: input.durationMs,
      syncStatus: 'pending',
      createdAt: Date.now(),
    };

    await db.runAsync(
      `INSERT OR REPLACE INTO audio
       (id, note_id, local_uri, duration_ms, sync_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        audio.id,
        audio.noteId,
        audio.localUri,
        audio.durationMs,
        audio.syncStatus,
        audio.createdAt,
      ],
    );

    return audio;
  }

  async getAllNotes(): Promise<DBNote[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DBNote>(
      `SELECT id, title, body, summary, latitude, longitude, location_name AS locationName,
              recorded_at AS recordedAt, record_status AS recordStatus,
              sync_status AS syncStatus, created_at AS createdAt, updated_at AS updatedAt
       FROM notes ORDER BY recorded_at DESC`,
    );
    return rows;
  }

  async getPhotosByNote(noteId: string): Promise<DBPhoto[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DBPhoto>(
      `SELECT id, note_id AS noteId, local_uri AS localUri, caption,
              offset_ms AS offsetMs, sync_status AS syncStatus, created_at AS createdAt
       FROM photos WHERE note_id = ? ORDER BY offset_ms ASC`,
      [noteId],
    );
    return rows;
  }

  async getAudioByNote(noteId: string): Promise<DBAudio | null> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DBAudio>(
      `SELECT id, note_id AS noteId, local_uri AS localUri, duration_ms AS durationMs,
              sync_status AS syncStatus, created_at AS createdAt
       FROM audio WHERE note_id = ? LIMIT 1`,
      [noteId],
    );
    return rows[0] ?? null;
  }

  async markSynced(
    entity: 'note' | 'photo' | 'audio',
    id: string,
  ): Promise<void> {
    const db = await getDatabase();
    const table = entity === 'note' ? 'notes' : entity === 'photo' ? 'photos' : 'audio';
    await db.runAsync(`UPDATE ${table} SET sync_status = 'synced' WHERE id = ?`, [id]);
  }

  async setNoteSummary(noteId: string, summary: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE notes SET summary = ?, updated_at = ? WHERE id = ?`,
      [summary, Date.now(), noteId],
    );
  }
}
