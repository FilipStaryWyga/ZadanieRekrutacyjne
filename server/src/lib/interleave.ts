import type { TranscribedSegment } from '../types';

export interface InterleavePhotoInput {
  offsetMs: number;
  caption: string | null;
}

export interface InterleaveResult {
  segmentIndex: number | null;
}

/**
 * Dopasowuje zdjęcie (offset w ms) do segmentu transkrypcji, w którym zostało
 * wykonane. Zwraca indeks segmentu (lub null, jeśli poza zakresem).
 * Segmenty są 1-indexowane względem całego nagrania.
 */
export function findSegmentForOffset(
  offsetMs: number,
  segments: TranscribedSegment[],
): InterleaveResult {
  if (segments.length === 0) {
    return { segmentIndex: null };
  }

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (offsetMs >= segment.start && offsetMs < segment.end) {
      return { segmentIndex: i };
    }
  }

  return { segmentIndex: null };
}

/**
 * Główny algorytm przeplotu transkrypcji i zdjęć.
 * Dla każdego zdjęcia wyznacza tekst transkrypcji odpowiadający chwili zdjęcia.
 */
export function interleavePhotosAndTranscript(
  segments: TranscribedSegment[],
  photos: InterleavePhotoInput[],
): Array<{
  photoIndex: number;
  offsetMs: number;
  segmentIndex: number | null;
  transcript: string;
}> {
  return photos.map((photo, index) => {
    const { segmentIndex } = findSegmentForOffset(photo.offsetMs, segments);
    const transcript =
      segmentIndex !== null ? segments[segmentIndex].text : '';
    return {
      photoIndex: index,
      offsetMs: photo.offsetMs,
      segmentIndex,
      transcript,
    };
  });
}
