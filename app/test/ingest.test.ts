import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIngestHandler, rawObjectKey } from '../src/core/ingest';
import { buildEvent, validReading } from './helpers';

const headers = { 'x-api-key': 'secret-key' };

function setup(saveResult = 1) {
  const deps = {
    getApiKey: vi.fn().mockResolvedValue('secret-key'),
    storeRaw: vi.fn().mockResolvedValue(undefined),
    saveReadings: vi.fn().mockResolvedValue(saveResult),
    now: () => new Date('2026-01-15T12:00:00Z'),
  };
  return { deps, handler: createIngestHandler(deps) };
}

describe('ingest handler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('returns 401 without a valid api key', async () => {
    const { handler, deps } = setup();
    const response = await handler(buildEvent({ body: { readings: [validReading()] } }));
    expect(response.statusCode).toBe(401);
    expect(deps.storeRaw).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const { handler } = setup();
    const response = await handler(buildEvent({ raw: '{oops', headers }));
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 with the failing paths for invalid readings', async () => {
    const { handler, deps } = setup();
    const response = await handler(
      buildEvent({ body: { readings: [validReading({ unit: 'X' })] }, headers }),
    );
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body as string).issues[0].path).toBe('readings.0.unit');
    expect(deps.storeRaw).not.toHaveBeenCalled();
  });

  it('stores the raw payload and saves normalized readings', async () => {
    const { handler, deps } = setup(1);
    const response = await handler(
      buildEvent({ body: { readings: [validReading({ value: 98.6, unit: 'F' })] }, headers }),
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body as string)).toEqual({ received: 1, inserted: 1, duplicates: 0 });
    expect(deps.storeRaw).toHaveBeenCalledWith('raw/2026/01/15/req-123.json', expect.any(String));
    expect(deps.saveReadings).toHaveBeenCalledWith(
      [expect.objectContaining({ value: 37, unit: 'C' })],
      'raw/2026/01/15/req-123.json',
    );
  });

  it('reports duplicates and returns 200 when nothing new was inserted', async () => {
    const { handler } = setup(0);
    const response = await handler(buildEvent({ body: { readings: [validReading()] }, headers }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ received: 1, inserted: 0, duplicates: 1 });
  });

  it('returns 500 without leaking details when a dependency fails', async () => {
    const { handler, deps } = setup();
    deps.saveReadings.mockRejectedValue(new Error('connection refused'));
    const response = await handler(buildEvent({ body: { readings: [validReading()] }, headers }));
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('connection refused');
  });
});

describe('rawObjectKey', () => {
  it('partitions objects by UTC date', () => {
    expect(rawObjectKey(new Date('2026-03-05T23:59:00Z'), 'abc')).toBe('raw/2026/03/05/abc.json');
  });
});
