import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { isValidApiKey } from '../lib/auth';
import { log } from '../lib/logger';
import { json } from '../lib/response';
import { normalize, type NormalizedReading } from './normalize';
import { batchSchema } from './schema';

export interface IngestDependencies {
  getApiKey(): Promise<string>;
  storeRaw(key: string, body: string): Promise<void>;
  saveReadings(readings: NormalizedReading[], rawObjectKey: string): Promise<number>;
  now(): Date;
}

export function rawObjectKey(now: Date, requestId: string): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `raw/${year}/${month}/${day}/${requestId}.json`;
}

function readBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) {
    return '';
  }
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}

export function createIngestHandler(deps: IngestDependencies) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    const requestId = event.requestContext.requestId;

    try {
      const apiKey = await deps.getApiKey();
      if (!isValidApiKey(event.headers['x-api-key'], apiKey)) {
        log.warn('rejected request with invalid api key', { requestId });
        return json(401, { error: 'unauthorized' });
      }

      const body = readBody(event);

      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        return json(400, { error: 'body must be valid JSON' });
      }

      const parsed = batchSchema.safeParse(payload);
      if (!parsed.success) {
        return json(400, {
          error: 'validation failed',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const key = rawObjectKey(deps.now(), requestId);
      await deps.storeRaw(key, body);

      const readings = parsed.data.readings.map(normalize);
      const inserted = await deps.saveReadings(readings, key);
      const duplicates = readings.length - inserted;

      log.info('batch ingested', { requestId, received: readings.length, inserted, duplicates });

      return json(inserted > 0 ? 201 : 200, {
        received: readings.length,
        inserted,
        duplicates,
      });
    } catch (error) {
      log.error('ingest failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return json(500, { error: 'internal error' });
    }
  };
}
