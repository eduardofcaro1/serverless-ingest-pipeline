import { Pool } from 'pg';
import rdsCaBundle from '../../certs/rds-global-bundle.pem';
import { getConfig } from './config';
import { log } from './logger';
import { getSecretString } from './secrets';

let pool: Pool | undefined;

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const config = getConfig();
  const credentials = JSON.parse(await getSecretString(config.dbSecretArn)) as {
    username: string;
    password: string;
  };

  pool = new Pool({
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    user: credentials.username,
    password: credentials.password,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    ssl: { ca: rdsCaBundle, rejectUnauthorized: true },
  });

  pool.on('error', (error) => log.error('idle database client error', { error: error.message }));

  return pool;
}
