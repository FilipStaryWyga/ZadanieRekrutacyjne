import {
  getNote,
  markAudioUploaded,
  markPhotoUploaded,
  saveProcessedNote,
  setStatus,
} from '../db/notes';
import type { Block, NoteStatus } from '../db/types';
import { formatOffset } from './format';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface UploadResult {
  ok: boolean;
  id?: string;
  objectKey?: string;
  error?: string;
}

export interface ProcessResponse {
  ok: boolean;
  noteId?: string;
  summary?: string;
  transcript?: Array<{ start: number; end: number; text: string }>;
  interleaved?: Array<{
    photoIndex: number;
    offsetMs: number;
    segmentIndex: number | null;
    transcript: string;
  }>;
  blocks?: Block[];
  error?: string;
}

async function postFormData(path: string, formData: FormData): Promise<UploadResult> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, error: text ? `Błąd serwera: ${text}` : `HTTP ${response.status}` };
    }
    return (await response.json()) as UploadResult;
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Błąd połączenia z serwerem' };
  }
}

export async function uploadNoteSync(
  note: { id: string; title: string; body: string; recordedAt: number },
): Promise<UploadResult> {
  try {
    const response = await fetch(`${API_URL}/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: note.id,
        title: note.title,
        body: note.body,
        recordedAt: new Date(note.recordedAt).toISOString(),
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    return (await response.json()) as UploadResult;
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Błąd połączenia z serwerem' };
  }
}

export async function uploadPhoto(
  noteId: string,
  fileUri: string,
  offsetMs: number,
  caption: string | null,
): Promise<UploadResult> {
  const formData = new FormData();
  const uriParts = fileUri.split('.');
  const extension = uriParts[uriParts.length - 1] ?? 'jpg';

  formData.append('file', {
    uri: fileUri,
    name: `photo-${Date.now()}.${extension}`,
    type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
  } as unknown as Blob);
  formData.append('offsetMs', String(offsetMs));
  if (caption) {
    formData.append('caption', caption);
  }

  const queryParams = new URLSearchParams({
    noteId,
    kind: 'photo',
    offsetMs: String(offsetMs),
  });
  if (caption) queryParams.set('caption', caption);

  return postFormData(`/upload?${queryParams.toString()}`, formData);
}

export async function uploadAudio(
  noteId: string,
  fileUri: string,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: `audio-${Date.now()}.m4a`,
    type: 'audio/mp4',
  } as unknown as Blob);

  const queryParams = new URLSearchParams({
    noteId,
    kind: 'audio',
  });

  return postFormData(`/upload?${queryParams.toString()}`, formData);
}

export async function processNoteOnBackend(noteId: string): Promise<ProcessResponse> {
  try {
    const response = await fetch(`${API_URL}/process/${noteId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      let errorMessage = `Błąd serwera (HTTP ${response.status})`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error || parsed.message) {
          errorMessage = parsed.error || parsed.message;
        }
      } catch {
        // użyj fallback
      }
      return { ok: false, error: errorMessage };
    }
    const data = (await response.json()) as ProcessResponse;
    return { ...data, ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Brak połączenia z serwerem' };
  }
}

/**
 * Kompletny pipeline przetwarzania notatki (Fail-safe):
 * 1. Zmiana statusu na 'uploading'
 * 2. Idempotentne przesłanie metadanych notatki, brakującego audio i nieprzesłanych zdjęć
 * 3. Zmiana statusu na 'processing'
 * 4. Wywołanie Whisper i LLM na backendzie
 * 5. Zapis wyniku (summary + blocks) do bazy SQLite i status 'ready'
 * W przypadku błędu: zachowanie plików lokalnych, status 'error', zapis errorMessage w SQLite.
 */
export async function processNotePipeline(
  noteId: string,
  onStatusChange?: (status: NoteStatus, message?: string) => void,
): Promise<{ summary: string; blocks: Block[] }> {
  const note = await getNote(noteId);
  if (!note) {
    throw new Error('Nie znaleziono notatki w pamięci urządzenia');
  }

  if (!note.audioUri) {
    throw new Error('Brak nagranego pliku audio dla tej notatki');
  }

  try {
    // 1. Wysyłanie
    onStatusChange?.('uploading');
    await setStatus(noteId, 'uploading');

    const metaRes = await uploadNoteSync({
      id: note.id,
      title: note.title,
      body: '',
      recordedAt: note.recordedAt,
    });
    if (!metaRes.ok) {
      throw new Error(metaRes.error ?? 'Błąd synchronizacji notatki');
    }

    if (!note.audioUploaded) {
      const audioRes = await uploadAudio(note.id, note.audioUri);
      if (!audioRes.ok) {
        throw new Error(audioRes.error ?? 'Błąd przesyłania nagrania audio');
      }
      await markAudioUploaded(note.id);
    }

    for (const photo of note.photos) {
      if (!photo.uploaded) {
        const photoRes = await uploadPhoto(note.id, photo.uri, photo.offsetMs, null);
        if (!photoRes.ok) {
          throw new Error(photoRes.error ?? `Błąd przesyłania zdjęcia (${formatOffset(photo.offsetMs)})`);
        }
        await markPhotoUploaded(photo.id);
      }
    }

    // 2. Przetwarzanie AI
    onStatusChange?.('processing');
    await setStatus(noteId, 'processing');

    const processRes = await processNoteOnBackend(note.id);
    if (!processRes.ok || !processRes.summary) {
      throw new Error(processRes.error ?? 'Błąd transkrypcji lub generowania podsumowania AI');
    }

    // 3. Dopasowanie lokalnych URI zdjęć do bloków
    const photosByOffset = new Map(note.photos.map((p) => [p.offsetMs, p]));
    const photosById = new Map(note.photos.map((p) => [p.id, p]));

    const rawBlocks = processRes.blocks ?? [];
    const resolvedBlocks: Block[] = rawBlocks.map((b) => {
      if (b.type === 'photo') {
        const localPhoto =
          photosById.get(b.photoId) ??
          (b.atMs !== undefined ? photosByOffset.get(b.atMs) : undefined);
        return {
          ...b,
          uri: localPhoto?.uri ?? b.uri,
        };
      }
      return b;
    });

    // 4. Zapis w SQLite
    await saveProcessedNote(noteId, processRes.summary, resolvedBlocks);
    onStatusChange?.('ready');

    return {
      summary: processRes.summary,
      blocks: resolvedBlocks,
    };
  } catch (err: any) {
    const errorMsg = err.message ?? 'Wystąpił nieoczekiwany błąd podczas przetwarzania';
    await setStatus(noteId, 'error', errorMsg);
    onStatusChange?.('error', errorMsg);
    throw err;
  }
}
