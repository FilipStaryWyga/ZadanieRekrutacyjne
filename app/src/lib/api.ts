// ============================================================================
// Obsługa API - komunikacja z backendem Fastify.
// Fail-safe: wysyła TYLKO brakujące pliki (retry), nie kasuje danych lokalnych.
// ============================================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface UploadResult {
  ok: boolean;
  id?: string;
  objectKey?: string;
  error?: string;
}

async function postFormData(path: string, formData: FormData): Promise<UploadResult> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }
  return (await response.json()) as UploadResult;
}

export async function uploadNoteSync(
  note: { id: string; title: string; body: string; recordedAt: number },
): Promise<UploadResult> {
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

  return postFormData(`/upload?noteId=${noteId}&kind=photo`, formData);
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

  return postFormData(`/upload?noteId=${noteId}&kind=audio`, formData);
}
