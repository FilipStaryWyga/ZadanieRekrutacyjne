import { Client } from 'minio';

export interface StorageConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export class StorageService {
  private client: Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.client = new Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = config.bucket;
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async putObject(
    objectKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async getObject(objectKey: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, objectKey);
    return streamToBuffer(stream);
  }
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
