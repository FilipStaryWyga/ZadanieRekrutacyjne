import type { Pool } from 'pg';
import type { Note, Photo, AudioMetadata } from './types';

export interface UpsertNoteInput {
  id: string;
  title: string;
  body: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  recordedAt: string;
}

export interface UpsertPhotoInput {
  id: string;
  noteId: string;
  objectKey: string;
  offsetMs: number;
  caption: string | null;
}

export interface UpsertAudioInput {
  id: string;
  noteId: string;
  objectKey: string;
  durationMs: number | null;
}

export class NoteRepository {
  constructor(private pool: Pool) {}

  // Idempotentny upsert notatki - kluczem jest ID wygenerowane na telefonie.
  async upsertNote(input: UpsertNoteInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO notes (id, title, body, latitude, longitude, location_name, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         location_name = EXCLUDED.location_name,
         recorded_at = EXCLUDED.recorded_at,
         updated_at = NOW()`,
      [
        input.id,
        input.title,
        input.body,
        input.latitude,
        input.longitude,
        input.locationName,
        input.recordedAt,
      ],
    );
  }

  async upsertPhoto(input: UpsertPhotoInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO photos (id, note_id, object_key, offset_ms, caption)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         note_id = EXCLUDED.note_id,
         object_key = EXCLUDED.object_key,
         offset_ms = EXCLUDED.offset_ms,
         caption = EXCLUDED.caption`,
      [input.id, input.noteId, input.objectKey, input.offsetMs, input.caption],
    );
  }

  async upsertAudio(input: UpsertAudioInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO audio (id, note_id, object_key, duration_ms)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         note_id = EXCLUDED.note_id,
         object_key = EXCLUDED.object_key,
         duration_ms = EXCLUDED.duration_ms`,
      [input.id, input.noteId, input.objectKey, input.durationMs],
    );
  }

  async updateSummary(noteId: string, summary: string): Promise<void> {
    await this.pool.query(
      `UPDATE notes SET summary = $2, updated_at = NOW() WHERE id = $1`,
      [noteId, summary],
    );
  }

  async getPhotosByNote(noteId: string): Promise<Photo[]> {
    const { rows } = await this.pool.query(
      `SELECT id, note_id AS "noteId", object_key AS "objectKey", url,
              offset_ms AS "offsetMs", caption, created_at AS "createdAt"
       FROM photos
       WHERE note_id = $1
       ORDER BY offset_ms ASC`,
      [noteId],
    );
    return rows;
  }

  async getAudioByNote(noteId: string): Promise<AudioMetadata | null> {
    const { rows } = await this.pool.query(
      `SELECT id, note_id AS "noteId", object_key AS "objectKey", url,
              duration_ms AS "durationMs", created_at AS "createdAt"
       FROM audio
       WHERE note_id = $1
       LIMIT 1`,
      [noteId],
    );
    return rows[0] ?? null;
  }

  async getAllNotes(): Promise<Note[]> {
    const { rows } = await this.pool.query(
      `SELECT id, title, body, summary, latitude, longitude,
              location_name AS "locationName", recorded_at AS "recordedAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM notes
       ORDER BY recorded_at DESC`,
    );
    return rows;
  }
}
