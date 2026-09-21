import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});
const cache = new Map<string, Promise<string>>();

async function fetchSecret(secretId: string): Promise<string> {
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!result.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`);
  }
  return result.SecretString;
}

export function getSecretString(secretId: string): Promise<string> {
  let cached = cache.get(secretId);
  if (!cached) {
    cached = fetchSecret(secretId);
    cache.set(secretId, cached);
    cached.catch(() => cache.delete(secretId));
  }
  return cached;
}
