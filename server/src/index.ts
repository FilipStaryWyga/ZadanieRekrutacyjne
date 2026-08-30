import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { loadConfig } from './config';
import { createPool } from './db';
import { NoteRepository } from './notesRepository';
import { StorageService } from './storage';
import { AIService } from './lib/openaiService';
import { notesRoutes } from './routes/notes';
import { uploadRoutes } from './routes/upload';
import { processRoutes } from './routes/process';

export type ServerApp = FastifyInstance & {
  pool: ReturnType<typeof createPool>;
  notes: NoteRepository;
  storage: StorageService;
  ai: AIService;
};

export async function buildServer(): Promise<ServerApp> {
  const config = loadConfig();

  const baseApp = Fastify({
    logger: true,
  });

  const fastify = baseApp as unknown as ServerApp;

  await fastify.register(cors, { origin: config.corsOrigin });
  await fastify.register(multipart, {
    limits: { fileSize: 200 * 1024 * 1024, files: 10 },
  });

  const pool = createPool(config.databaseUrl);
  const notes = new NoteRepository(pool);
  const storage = new StorageService(config.minio);
  const ai = new AIService({ openaiApiKey: config.openaiApiKey });

  fastify.pool = pool;
  fastify.notes = notes;
  fastify.storage = storage;
  fastify.ai = ai;

  fastify.addHook('onClose', async () => {
    await pool.end();
  });

  await storage.ensureBucket();

  fastify.register(notesRoutes, { prefix: '/notes' });
  fastify.register(uploadRoutes, { prefix: '/upload' });
  fastify.register(processRoutes, { prefix: '/process' });

  fastify.get('/health', async () => ({ status: 'ok' }));

  return fastify;
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

if (require.main === module) {
  void (async () => {
    const server = await buildServer();
    try {
      await server.listen({ port, host });
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  })();
}
