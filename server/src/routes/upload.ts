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
}

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify as ServerApp;

  server.post<{ Querystring: UploadQuery }>(
    '/',
    async (request, reply) => {
      const { noteId, kind } = request.query;

      const part = await request.file();
      if (!part) {
        return reply.status(400).send({ error: 'Brak pliku w żądaniu' });
      }

      const extension = part.filename.split('.').pop() ?? 'bin';
      const objectKey = `${noteId}/${kind}-${randomUUID()}.${extension}`;
      const bytes = await part.toBuffer();

      await server.storage.putObject(objectKey, bytes, part.mimetype);

      if (kind === 'audio') {
        const input: UpsertAudioInput = {
          id: randomUUID(),
          noteId,
          objectKey,
          durationMs: null,
        };
        await server.notes.upsertAudio(input);
        return reply.status(201).send({ ok: true, id: input.id, objectKey });
      }

      const offsetMs = Number(readFieldValue(part.fields, 'offsetMs', '0'));
      const caption = readFieldValue(part.fields, 'caption', null);

      const input: UpsertPhotoInput = {
        id: randomUUID(),
        noteId,
        objectKey,
        offsetMs,
        caption,
      };
      await server.notes.upsertPhoto(input);
      return reply.status(201).send({ ok: true, id: input.id, objectKey });
    },
  );
};
