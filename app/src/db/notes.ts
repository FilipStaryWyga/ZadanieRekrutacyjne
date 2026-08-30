import { getDatabase } from './schema';
import type {
  AddPhotoInput,
  Block,
  CreateNoteInput,
  FinishRecordingInput,
  Note,
  NoteListItem,
  NoteStatus,
  Photo,
} from './types';

type NoteRow = {
  id: string;
  title: string;
  status: NoteStatus;
  recorded_at: number;
  duration_ms: number | null;
  audio_uri: string | null;
  summary: string | null;
  blocks_json: string | null;
  error_message: string | null;
  audio_uploaded: number;
};

type PhotoRow = {
  id: string;
  note_id: string;
  uri: string;
  offset_ms: number;
  uploaded: number;
};

function parseBlocks(raw: string | null): Block[] | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Block[];
  } catch {
    return null;
  }
}

function mapPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    noteId: row.note_id,
    uri: row.uri,
    offsetMs: row.offset_ms,
    uploaded: row.uploaded === 1,
  };
}

function mapNote(row: NoteRow, photos: Photo[]): Note {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    recordedAt: row.recorded_at,
    durationMs: row.duration_ms,
    audioUri: row.audio_uri,
    summary: row.summary,
    blocks: parseBlocks(row.blocks_json),
    errorMessage: row.error_message,
    audioUploaded: row.audio_uploaded === 1,
    photos,
  };
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const db = await getDatabase();
  const now = Date.now();

  await db.runAsync(
    `INSERT OR IGNORE INTO notes
     (id, title, status, recorded_at, duration_ms, audio_uri, summary, blocks_json,
      error_message, audio_uploaded, created_at, updated_at)
     VALUES (?, ?, 'recorded', ?, NULL, NULL, NULL, NULL, NULL, 0, ?, ?)`,
    [input.id, input.title?.trim() ?? '', now, now, now],
  );

  const note = await getNote(input.id);
  if (!note) {
    throw new Error('Nie udało się utworzyć notatki');
  }
  return note;
}

export async function addPhoto(input: AddPhotoInput): Promise<Photo> {
  const db = await getDatabase();
  const photo: Photo = {
    id: input.id,
    noteId: input.noteId,
    uri: input.uri,
    offsetMs: input.offsetMs,
    uploaded: false,
  };

  await db.runAsync(
    `INSERT OR REPLACE INTO photos (id, note_id, uri, offset_ms, uploaded, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [photo.id, photo.noteId, photo.uri, photo.offsetMs, Date.now()],
  );

  return photo;
}

export async function finishRecording(input: FinishRecordingInput): Promise<Note> {
  const db = await getDatabase();
  const now = Date.now();

  await db.runAsync(
    `UPDATE notes
     SET title = ?, audio_uri = ?, duration_ms = ?, status = 'recorded',
         error_message = NULL, updated_at = ?
     WHERE id = ?`,
    [input.title.trim() || 'Notatka bez tytułu', input.audioUri, input.durationMs, now, input.noteId],
  );

  const note = await getNote(input.noteId);
  if (!note) {
    throw new Error('Nie znaleziono notatki po zakończeniu nagrania');
  }
  return note;
}

export async function setStatus(
  noteId: string,
  status: NoteStatus,
  errorMessage: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notes SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`,
    [status, errorMessage, Date.now(), noteId],
  );
}

export async function listNotes(): Promise<NoteListItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<NoteRow & { thumbnail_uri: string | null }>(
    `SELECT n.id, n.title, n.status, n.recorded_at, n.duration_ms, n.audio_uri,
            n.summary, n.blocks_json, n.error_message, n.audio_uploaded,
            (
              SELECT p.uri FROM photos p
              WHERE p.note_id = n.id
              ORDER BY p.offset_ms ASC, p.created_at ASC
              LIMIT 1
            ) AS thumbnail_uri
     FROM notes n
     WHERE n.audio_uri IS NOT NULL
     ORDER BY n.recorded_at DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    recordedAt: row.recorded_at,
    durationMs: row.duration_ms,
    thumbnailUri: row.thumbnail_uri,
    errorMessage: row.error_message,
  }));
}

export async function saveProcessedNote(
  noteId: string,
  summary: string,
  blocks: Block[],
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notes
     SET summary = ?, blocks_json = ?, status = 'ready', error_message = NULL, updated_at = ?
     WHERE id = ?`,
    [summary, JSON.stringify(blocks), Date.now(), noteId],
  );
}

export async function markAudioUploaded(noteId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notes SET audio_uploaded = 1, updated_at = ? WHERE id = ?`,
    [Date.now(), noteId],
  );
}

export async function markPhotoUploaded(photoId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE photos SET uploaded = 1 WHERE id = ?`,
    [photoId],
  );
}

export async function getNote(id: string): Promise<Note | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<NoteRow>(
    `SELECT id, title, status, recorded_at, duration_ms, audio_uri, summary,
            blocks_json, error_message, audio_uploaded
     FROM notes WHERE id = ?`,
    [id],
  );
  if (!row) {
    return null;
  }

  const photoRows = await db.getAllAsync<PhotoRow>(
    `SELECT id, note_id, uri, offset_ms, uploaded
     FROM photos WHERE note_id = ? ORDER BY offset_ms ASC, created_at ASC`,
    [id],
  );

  return mapNote(row, photoRows.map(mapPhoto));
}
