import { createIngestHandler } from '../core/ingest';
import { insertReadings } from '../core/repository';
import { getConfig } from '../lib/config';
import { getPool } from '../lib/db';
import { getSecretString } from '../lib/secrets';
import { putRawPayload } from '../lib/storage';

export const handler = createIngestHandler({
  getApiKey: () => getSecretString(getConfig().apiKeySecretArn),
  storeRaw: (key, body) => putRawPayload(getConfig().rawBucket, key, body),
  saveReadings: async (readings, rawObjectKey) =>
    insertReadings(await getPool(), readings, rawObjectKey),
  now: () => new Date(),
});
