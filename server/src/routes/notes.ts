import type { FastifyPluginAsync } from 'fastify';
import type { ServerApp } from '../index';
import type { UpsertNoteInput } from '../notesRepository';

interface NoteBody {
  id: string;
  title: string;
  body?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  recordedAt: string;
}

export const notesRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify as ServerApp;

  server.get('/', async () => {
    const notes = await server.notes.getAllNotes();
    return notes;
  });

  server.put<{ Body: NoteBody }>('/:id', async (request, reply) => {
    const body = request.body;
    const input: UpsertNoteInput = {
      id: body.id,
      title: body.title,
      body: body.body ?? '',
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      locationName: body.locationName ?? null,
      recordedAt: body.recordedAt,
    };
    await server.notes.upsertNote(input);
    return reply.status(200).send({ ok: true, id: input.id });
  });

  server.get<{ Params: { id: string } }>('/:id', async (request) => {
    const photos = await server.notes.getPhotosByNote(request.params.id);
    const audio = await server.notes.getAudioByNote(request.params.id);
    return { id: request.params.id, photos, audio };
  });
};
