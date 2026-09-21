export interface Migration {
  id: string;
  sql: string;
}

export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const LOCK_ID = 727001;

export async function runMigrations(client: Queryable, migrations: Migration[]): Promise<string[]> {
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);

  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const { rows } = await client.query('SELECT id FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.id as string));
    const executed: string[] = [];

    for (const migration of migrations) {
      if (applied.has(migration.id)) {
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      executed.push(migration.id);
    }

    return executed;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
  }
}
