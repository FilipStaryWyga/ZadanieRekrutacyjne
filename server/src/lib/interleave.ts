import type { TranscribedSegment } from '../types';

export interface InterleavePhotoInput {
  id?: string;
  offsetMs: number;
  caption: string | null;
  objectKey?: string;
}

export interface InterleaveResult {
  segmentIndex: number | null;
}

/**
 * Dopasowuje zdjęcie (offset w ms) do segmentu transkrypcji, w którym zostało
 * wykonane. Zwraca indeks segmentu (lub null, jeśli poza zakresem).
 * Uwzględnia tolerancję na naturalne pauzy w wypowiedzi.
 */
export function findSegmentForOffset(
  offsetMs: number,
  segments: TranscribedSegment[],
  maxGapToleranceMs: number = 3000,
): InterleaveResult {
  if (segments.length === 0) {
    return { segmentIndex: null };
  }

  // 1. Bezpośrednie trafienie wewnątrz segmentu [start, end)
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (offsetMs >= segment.start && offsetMs < segment.end) {
      return { segmentIndex: i };
    }
  }

  // 2. Obsługa pauzy pomiędzy dwoma segmentami (przypisanie do bliższego segmentu)
  for (let i = 0; i < segments.length - 1; i += 1) {
    const curr = segments[i];
    const next = segments[i + 1];
    if (offsetMs > curr.end && offsetMs < next.start) {
      const distToPrev = offsetMs - curr.end;
      const distToNext = next.start - offsetMs;
      if (Math.min(distToPrev, distToNext) <= maxGapToleranceMs) {
        return { segmentIndex: distToPrev <= distToNext ? i : i + 1 };
      }
    }
  }

  // 3. Niewielkie wyprzedzenie początku lub opóźnienie po zakończeniu
  const first = segments[0];
  if (offsetMs < first.start && first.start - offsetMs <= maxGapToleranceMs) {
    return { segmentIndex: 0 };
  }

  const last = segments[segments.length - 1];
  if (offsetMs > last.end && offsetMs - last.end <= maxGapToleranceMs) {
    return { segmentIndex: segments.length - 1 };
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

/**
 * Generuje zintegrowany ciąg bloków (tekst + zdjęcia osadzone w czasie)
 * gotowy do wyświetlenia na osi czasu w aplikacji mobilnej.
 */
export function generateInterleavedBlocks(
  segments: TranscribedSegment[],
  photos: InterleavePhotoInput[],
): Array<
  | { type: 'paragraph'; text: string; startMs: number; endMs: number }
  | { type: 'photo'; photoId: string; atMs: number; objectKey?: string }
> {
  type TimelineItem =
    | { kind: 'segment'; time: number; segment: TranscribedSegment }
    | { kind: 'photo'; time: number; photo: InterleavePhotoInput };

  const items: TimelineItem[] = [];

  for (const seg of segments) {
    items.push({ kind: 'segment', time: seg.start, segment: seg });
  }

  for (const photo of photos) {
    items.push({ kind: 'photo', time: photo.offsetMs, photo });
  }

  // Sortowanie chronologiczne
  items.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    // Jeśli czasy są identyczne, tekst segmentu przed zdjęciem
    return a.kind === 'segment' ? -1 : 1;
  });

  const result: Array<
    | { type: 'paragraph'; text: string; startMs: number; endMs: number }
    | { type: 'photo'; photoId: string; atMs: number; objectKey?: string }
  > = [];

  for (const item of items) {
    if (item.kind === 'segment') {
      result.push({
        type: 'paragraph',
        text: item.segment.text,
        startMs: item.segment.start,
        endMs: item.segment.end,
      });
    } else {
      result.push({
        type: 'photo',
        photoId: item.photo.id ?? `photo-${item.photo.offsetMs}`,
        atMs: item.photo.offsetMs,
        objectKey: item.photo.objectKey,
      });
    }
  }

  return result;
}
