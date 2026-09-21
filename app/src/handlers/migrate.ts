import { migrations } from '../../migrations';
import { runMigrations } from '../core/migrations';
import { getPool } from '../lib/db';
import { log } from '../lib/logger';

export const handler = async () => {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const applied = await runMigrations(client, migrations);
    log.info('migrations finished', { applied });
    return { applied };
  } finally {
    client.release();
  }
};
