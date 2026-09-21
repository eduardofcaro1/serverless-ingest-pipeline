import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrations } from '../../migrations';
import { createIngestHandler } from '../../src/core/ingest';
import { runMigrations } from '../../src/core/migrations';
import { insertReadings } from '../../src/core/repository';
import type { NormalizedReading } from '../../src/core/normalize';
import { buildEvent, validReading } from '../helpers';

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/ingest';

const schema = `it_${randomUUID().replaceAll('-', '').slice(0, 12)}`;

let admin: Pool;
let pool: Pool;

function reading(overrides: Partial<NormalizedReading> = {}): NormalizedReading {
  return {
    idempotencyKey: randomUUID(),
    deviceId: 'sensor-01',
    metric: 'temperature',
    value: 21.5,
    unit: 'C',
    recordedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

async function countRows(): Promise<number> {
  const result = await pool.query('SELECT count(*)::int AS total FROM readings');
  return result.rows[0].total;
}

async function migrate(): Promise<string[]> {
  const client = await pool.connect();
  try {
    return await runMigrations(client, migrations);
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  admin = new Pool({ connectionString: databaseUrl, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);

  pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    options: `-c search_path=${schema}`,
  });
});

afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});

describe('migrations', () => {
  it('create the schema once and skip it on the next run', async () => {
    expect(await migrate()).toEqual(['001_create_readings']);
    expect(await migrate()).toEqual([]);
  });
});

describe('readings repository', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE readings');
  });

  it('inserts every reading of a batch', async () => {
    const inserted = await insertReadings(pool, [reading(), reading(), reading()], 'raw/a.json');
    expect(inserted).toBe(3);
    expect(await countRows()).toBe(3);
  });

  it('stores typed values and the raw object reference', async () => {
    const item = reading({ value: 37, recordedAt: '2026-01-15T10:30:00.000Z' });
    await insertReadings(pool, [item], 'raw/2026/01/15/req.json');

    const { rows } = await pool.query(
      'SELECT device_id, metric, value, unit, recorded_at, raw_object_key FROM readings',
    );

    expect(rows[0].device_id).toBe('sensor-01');
    expect(rows[0].value).toBe(37);
    expect(rows[0].recorded_at.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    expect(rows[0].raw_object_key).toBe('raw/2026/01/15/req.json');
  });

  it('ignores a batch that was already received', async () => {
    const batch = [reading(), reading()];

    expect(await insertReadings(pool, batch, 'raw/a.json')).toBe(2);
    expect(await insertReadings(pool, batch, 'raw/b.json')).toBe(0);
    expect(await countRows()).toBe(2);
  });

  it('inserts only the new readings of a partially repeated batch', async () => {
    const existing = reading();
    await insertReadings(pool, [existing], 'raw/a.json');

    const inserted = await insertReadings(pool, [existing, reading()], 'raw/b.json');
    expect(inserted).toBe(1);
    expect(await countRows()).toBe(2);
  });

  it('handles a repeated key inside the same batch', async () => {
    const item = reading();
    const inserted = await insertReadings(pool, [item, item], 'raw/a.json');
    expect(inserted).toBe(1);
    expect(await countRows()).toBe(1);
  });
});

describe('ingest handler with a real database', () => {
  const rawObjects = new Map<string, string>();

  const handler = createIngestHandler({
    getApiKey: async () => 'secret-key',
    storeRaw: async (key, body) => {
      rawObjects.set(key, body);
    },
    saveReadings: (readings, rawObjectKey) => insertReadings(pool, readings, rawObjectKey),
    now: () => new Date('2026-01-15T12:00:00Z'),
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE readings');
    rawObjects.clear();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('normalizes, stores and deduplicates a batch end to end', async () => {
    const event = buildEvent({
      headers: { 'x-api-key': 'secret-key' },
      body: { readings: [validReading({ value: 98.6, unit: 'F' })] },
    });

    const first = await handler(event);
    const second = await handler(event);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body as string)).toEqual({ received: 1, inserted: 0, duplicates: 1 });

    const { rows } = await pool.query('SELECT value, unit, raw_object_key FROM readings');
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(37);
    expect(rows[0].unit).toBe('C');
    expect(rawObjects.has(rows[0].raw_object_key)).toBe(true);
  });

  it('does not touch the database when validation fails', async () => {
    const response = await handler(
      buildEvent({
        headers: { 'x-api-key': 'secret-key' },
        body: { readings: [validReading({ unit: 'X' })] },
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(await countRows()).toBe(0);
    expect(rawObjects.size).toBe(0);
  });
});
