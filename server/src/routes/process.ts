import type { FastifyPluginAsync } from 'fastify';
import type { ServerApp } from '../index';
import { interleavePhotosAndTranscript, generateInterleavedBlocks } from '../lib/interleave';
import type { UpsertPhotoInput } from '../notesRepository';

interface ProcessQuery {
  noteId: string;
}

export const processRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify as ServerApp;

  server.get<{ Querystring: ProcessQuery }>('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const audio = await server.notes.getAudioByNote(id);
    if (!audio) {
      return reply.status(404).send({ error: 'Brak nagrania audio dla notatki' });
    }

    const photos = await server.notes.getPhotosByNote(id);

    const audioBuffer = await server.storage.getObject(audio.objectKey);
    const result = await server.ai.process(
      {
        fileBuffer: audioBuffer,
        mimeType: 'audio/mp4',
        filename: `${id}.m4a`,
      },
      `notatka-${id}`,
    );

    await server.notes.updateSummary(id, result.summary);

    const interleaved = interleavePhotosAndTranscript(result.transcript, photos);
    const blocks = generateInterleavedBlocks(result.transcript, photos);

    return {
      noteId: id,
      summary: result.summary,
      transcript: result.transcript,
      interleaved,
      blocks,
    };
  });

  // Wariant POST umożliwiający retransmisję brakującego pliku (fail-safe).
  server.post<{ Querystring: ProcessQuery }>('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const part = await request.file();
    const audio = await server.notes.getAudioByNote(id);

    const upsert: UpsertPhotoInput | null = null;

    if (part && !audio) {
      const extension = part.filename.split('.').pop() ?? 'm4a';
      const objectKey = `${id}/audio-${id}.${extension}`;
      const bytes = await part.toBuffer();
      await server.storage.putObject(objectKey, bytes, part.mimetype);
    }

    void upsert;

    return reply.status(200).send({ ok: true });
  });
};
