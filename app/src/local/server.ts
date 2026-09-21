import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import path from 'node:path';
import { Pool } from 'pg';
import { migrations } from '../../migrations';
import { createIngestHandler } from '../core/ingest';
import { runMigrations } from '../core/migrations';
import { insertReadings } from '../core/repository';
import { log } from '../lib/logger';

const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.API_KEY ?? 'local-dev-key';
const rawDir = process.env.RAW_DIR ?? '.local/raw';
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/ingest';

const MAX_BODY_BYTES = 1_000_000;

const pool = new Pool({ connectionString: databaseUrl, max: 5 });

const handler = createIngestHandler({
  getApiKey: async () => apiKey,
  storeRaw: async (key, body) => {
    const target = path.join(rawDir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  },
  saveReadings: (readings, rawObjectKey) => insertReadings(pool, readings, rawObjectKey),
  now: () => new Date(),
});

async function readBody(request: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      return undefined;
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function applyMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    const applied = await runMigrations(client, migrations);
    log.info('migrations finished', { applied });
  } finally {
    client.release();
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/readings') {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  const body = await readBody(request);
  if (body === undefined) {
    response.writeHead(413, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'payload too large' }));
    return;
  }

  const event = {
    version: '2.0',
    routeKey: 'POST /readings',
    rawPath: '/readings',
    rawQueryString: '',
    headers: request.headers,
    requestContext: { requestId: randomUUID() },
    body,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;

  const result = await handler(event);
  response.writeHead(result.statusCode ?? 500, result.headers as Record<string, string>);
  response.end(result.body);
});

applyMigrations()
  .then(() => {
    server.listen(port, () => {
      log.info('local server listening', { url: `http://localhost:${port}`, rawDir });
    });
  })
  .catch((error) => {
    log.error('could not start local server', { error: String(error) });
    process.exit(1);
  });

process.on('SIGINT', () => {
  server.close(() => pool.end().then(() => process.exit(0)));
});
