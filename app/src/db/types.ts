export type NoteStatus =
  | 'recorded'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'error';

export type Photo = {
  id: string;
  noteId: string;
  uri: string;
  offsetMs: number;
  uploaded: boolean;
};

export type Block =
  | { type: 'paragraph'; text: string; startMs?: number; endMs?: number }
  | { type: 'photo'; photoId: string; atMs: number; uri?: string; objectKey?: string };

export type Note = {
  id: string;
  title: string;
  status: NoteStatus;
  recordedAt: number;
  durationMs: number | null;
  audioUri: string | null;
  summary: string | null;
  blocks: Block[] | null;
  errorMessage: string | null;
  audioUploaded: boolean;
  photos: Photo[];
};

export type NoteListItem = {
  id: string;
  title: string;
  status: NoteStatus;
  recordedAt: number;
  durationMs: number | null;
  thumbnailUri: string | null;
  errorMessage: string | null;
};

export type CreateNoteInput = {
  id: string;
  title?: string;
};

export type AddPhotoInput = {
  id: string;
  noteId: string;
  uri: string;
  offsetMs: number;
};

export type FinishRecordingInput = {
  noteId: string;
  title: string;
  audioUri: string;
  durationMs: number;
};
