import 'dotenv/config';
import type { ServerConfig } from './types';

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgres://notatnik:notatnik@localhost:5432/notatnik',
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    minio: {
      endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'notatnik',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'notatniksecret',
      bucket: process.env.MINIO_BUCKET ?? 'notatnik-media',
    },
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}
