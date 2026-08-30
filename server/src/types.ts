export type UUID = string;

export interface Note {
  id: UUID;
  title: string;
  body: string;
  summary: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
  audio: AudioMetadata | null;
}

export interface Photo {
  id: UUID;
  noteId: UUID;
  objectKey: string;
  url: string | null;
  offsetMs: number;
  caption: string | null;
  createdAt: string;
}

export interface AudioMetadata {
  id: UUID;
  noteId: UUID;
  objectKey: string;
  url: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface TranscribedSegment {
  start: number;
  end: number;
  text: string;
}

export interface ProcessResult {
  transcript: TranscribedSegment[];
  summary: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  databaseUrl: string;
  corsOrigin: string;
  minio: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
  openaiApiKey: string | undefined;
  anthropicApiKey: string | undefined;
}
