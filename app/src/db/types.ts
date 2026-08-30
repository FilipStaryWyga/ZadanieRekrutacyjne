export type UUID = string;

// ============================================================================
// Typy domenowe - wspólne dla warstwy DB i UI.
// Schemat SQLite współdzielony z backendem (Postgres) w zakresie domeny.
// ============================================================================

export interface DBNote {
  id: UUID;
  title: string;
  body: string;
  summary: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  recordedAt: number; // epoch ms - liczone lokalnie na telefonie
  recordStatus: 'recording' | 'done';
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  createdAt: number;
  updatedAt: number;
}

export interface DBPhoto {
  id: UUID;
  noteId: UUID;
  localUri: string;
  caption: string | null;
  offsetMs: number; // offset liczony WYŁĄCZNIE z recorder.getStatus().durationMillis
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  createdAt: number;
}

export interface DBAudio {
  id: UUID;
  noteId: UUID;
  localUri: string;
  durationMs: number | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  createdAt: number;
}

export type NewNoteInput = Pick<
  DBNote,
  'id' | 'title' | 'recordedAt' | 'longitude' | 'latitude' | 'locationName'
>;

export type NewPhotoInput = Pick<
  DBPhoto,
  'id' | 'noteId' | 'localUri' | 'caption' | 'offsetMs'
>;

export type NewAudioInput = Pick<DBAudio, 'id' | 'noteId' | 'localUri' | 'durationMs'>;
