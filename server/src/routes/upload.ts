import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ServerApp } from '../index';
import type { UpsertPhotoInput, UpsertAudioInput } from '../notesRepository';

type MultipartField =
  | { value?: unknown }
  | { value?: unknown }[]
  | undefined;

function readFieldValue(
  fields: { [name: string]: unknown },
  name: string,
  fallback: string | null,
): string | null {
  const entry = fields[name] as MultipartField;
  const raw = Array.isArray(entry) ? entry[0]?.value : entry?.value;
  if (typeof raw === 'string') {
    return raw;
  }
  return fallback;
}

interface UploadQuery {
  noteId: string;
  kind: 'audio' | 'photo';
  id?: string;
  offsetMs?: string;
  caption?: string;
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify as ServerApp;

  server.post<{ Querystring: UploadQuery }>(
    '/',
    async (request, reply) => {
      const { noteId, kind, id: queryId, offsetMs: queryOffsetMs, caption: queryCaption } = request.query;

      const part = await request.file();
      if (!part) {
        return reply.status(400).send({ error: 'Brak pliku w żądaniu' });
      }

      const extension = part.filename.split('.').pop() ?? (kind === 'audio' ? 'm4a' : 'jpg');
      const objectKey = `${noteId}/${kind}-${randomUUID()}.${extension}`;
      const bytes = await part.toBuffer();

      await server.storage.putObject(objectKey, bytes, part.mimetype);

      if (kind === 'audio') {
        const input: UpsertAudioInput = {
          id: queryId ?? randomUUID(),
          noteId,
          objectKey,
          durationMs: null,
        };
        await server.notes.upsertAudio(input);
        return reply.status(201).send({ ok: true, id: input.id, objectKey });
      }

      const offsetRaw = queryOffsetMs ?? readFieldValue(part.fields, 'offsetMs', '0');
      const offsetMs = Number(offsetRaw ?? '0');
      const caption = queryCaption ?? readFieldValue(part.fields, 'caption', null);

      const input: UpsertPhotoInput = {
        id: queryId ?? randomUUID(),
        noteId,
        objectKey,
        offsetMs: isNaN(offsetMs) ? 0 : offsetMs,
        caption,
      };
      await server.notes.upsertPhoto(input);
      return reply.status(201).send({ ok: true, id: input.id, objectKey });
    },
  );
};
