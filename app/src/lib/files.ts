import * as FileSystem from 'expo-file-system/legacy';

// ============================================================================
// Moduł plików - zapis WYŁĄCZNIE w Documents/, NIGDY w Cache/.
// Pliki lokalne nigdy nie giną przy błędzie backendu (fail-safe).
// ============================================================================

const NOTEBOOK_DIR = 'notatnik';

async function ensureRootDirectory(): Promise<string> {
  const docs = FileSystem.documentDirectory;
  if (!docs) {
    throw new Error('Brak dostępu do katalogu dokumentów');
  }
  const dir = `${docs}${NOTEBOOK_DIR}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function saveToDocuments(
  sourceUri: string,
  subdir: 'photos' | 'audio',
  filename: string,
): Promise<string> {
  const parent = await ensureRootDirectory();
  const targetDir = `${parent}${subdir}/`;
  const dirInfo = await FileSystem.getInfoAsync(targetDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  }
  const targetUri = `${targetDir}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
  return targetUri;
}

export function buildPhotoFilename(noteId: string, photoId: string): string {
  return `${noteId}_${photoId}_${Date.now()}.jpg`;
}

export function buildAudioFilename(noteId: string, audioId: string): string {
  return `${noteId}_${audioId}.m4a`;
}
