import { describe, it, expect } from 'vitest';
import {
  findSegmentForOffset,
  interleavePhotosAndTranscript,
} from '../src/lib/interleave';
import type { TranscribedSegment } from '../src/types';

const segments: TranscribedSegment[] = [
  { start: 0, end: 3000, text: 'Witamy na terenie badań' },
  { start: 3000, end: 7000, text: 'Zauważamy ślady bobra' },
  { start: 7000, end: 10000, text: 'Robimy zdjęcie tamy' },
];

describe('findSegmentForOffset', () => {
  it('dopasowuje offset wewnątrz segmentu', () => {
    expect(findSegmentForOffset(4000, segments)).toEqual({ segmentIndex: 1 });
  });

  it('zwraca null dla offsetu poza zasięgiem', () => {
    expect(findSegmentForOffset(100001, segments)).toEqual({
      segmentIndex: null,
    });
  });

  it('zwraca null dla pustej listy segmentów', () => {
    expect(findSegmentForOffset(1000, [])).toEqual({ segmentIndex: null });
  });

  it('offset na granicy należy do segmentu rozpoczynającego się w tym punkcie', () => {
    expect(findSegmentForOffset(3000, segments)).toEqual({ segmentIndex: 1 });
  });
});

describe('interleavePhotosAndTranscript', () => {
  it('przeplata zdjęcia z tekstem transkrypcji', () => {
    const photos = [
      { offsetMs: 500, caption: 'start' },
      { offsetMs: 4000, caption: 'bóbr' },
      { offsetMs: 8000, caption: 'tama' },
    ];
    const result = interleavePhotosAndTranscript(segments, photos);

    expect(result).toHaveLength(3);
    expect(result[0].transcript).toBe('Witamy na terenie badań');
    expect(result[1].transcript).toBe('Zauważamy ślady bobra');
    expect(result[2].transcript).toBe('Robimy zdjęcie tamy');
    expect(result[0].segmentIndex).toBe(0);
  });

  it('zwraca pusty tekst dla zdjęcia spoza zakresu', () => {
    const result = interleavePhotosAndTranscript(segments, [
      { offsetMs: 999999, caption: 'poza' },
    ]);
    expect(result[0].transcript).toBe('');
    expect(result[0].segmentIndex).toBeNull();
  });
});
