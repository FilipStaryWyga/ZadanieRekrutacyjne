import * as FileSystem from 'expo-file-system/legacy';

function documentsRoot(): string {
  const docs = FileSystem.documentDirectory;
  if (!docs) {
    throw new Error('Brak dostępu do katalogu Documents');
  }
  return docs;
}

export function noteDirectory(noteId: string): string {
  return `${documentsRoot()}notes/${noteId}/`;
}

export function photosDirectory(noteId: string): string {
  return `${noteDirectory(noteId)}photos/`;
}

export function audioPath(noteId: string): string {
  return `${noteDirectory(noteId)}audio.m4a`;
}

export function photoPath(noteId: string, photoId: string): string {
  return `${photosDirectory(noteId)}${photoId}.jpg`;
}

export async function ensureNoteDirectories(noteId: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(photosDirectory(noteId), {
    intermediates: true,
  });
}

export async function savePhotoFile(
  noteId: string,
  photoId: string,
  sourceUri: string,
): Promise<string> {
  await ensureNoteDirectories(noteId);
  const dest = photoPath(noteId, photoId);
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function saveAudioFile(noteId: string, sourceUri: string): Promise<string> {
  await ensureNoteDirectories(noteId);
  const dest = audioPath(noteId);
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
