import { describe, it, expect } from 'vitest';
import {
  findSegmentForOffset,
  interleavePhotosAndTranscript,
  generateInterleavedBlocks,
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

  it('dopasowuje zdjęcie wykonane w czasie pauzy do najbliższego segmentu', () => {
    const segmentsWithGap: TranscribedSegment[] = [
      { start: 0, end: 2000, text: 'Zderzak przedni' },
      { start: 5000, end: 7000, text: 'Błotnik lewy' },
    ];
    // 2500ms jest 500ms po pierwszym segmencie i 2500ms przed drugim -> segmentIndex 0
    expect(findSegmentForOffset(2500, segmentsWithGap)).toEqual({ segmentIndex: 0 });
    // 4500ms jest 500ms przed drugim segmentem -> segmentIndex 1
    expect(findSegmentForOffset(4500, segmentsWithGap)).toEqual({ segmentIndex: 1 });
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

describe('generateInterleavedBlocks', () => {
  it('układa segmenty i zdjęcia w prawidłowej kolejności chronologicznej', () => {
    const photos = [
      { id: 'p1', offsetMs: 1500, caption: 'zdjęcie 1' },
      { id: 'p2', offsetMs: 5000, caption: 'zdjęcie 2' },
    ];
    const blocks = generateInterleavedBlocks(segments, photos);

    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      text: 'Witamy na terenie badań',
      startMs: 0,
      endMs: 3000,
    });
    expect(blocks[1]).toEqual({
      type: 'photo',
      photoId: 'p1',
      atMs: 1500,
      objectKey: undefined,
    });
    expect(blocks[2]).toEqual({
      type: 'paragraph',
      text: 'Zauważamy ślady bobra',
      startMs: 3000,
      endMs: 7000,
    });
    expect(blocks[3]).toEqual({
      type: 'photo',
      photoId: 'p2',
      atMs: 5000,
      objectKey: undefined,
    });
    expect(blocks[4]).toEqual({
      type: 'paragraph',
      text: 'Robimy zdjęcie tamy',
      startMs: 7000,
      endMs: 10000,
    });
  });
});
