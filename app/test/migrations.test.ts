import { describe, expect, it } from 'vitest';
import { runMigrations, type Queryable } from '../src/core/migrations';

function fakeClient(applied: string[] = []) {
  const statements: string[] = [];
  const client: Queryable = {
    async query(text) {
      statements.push(text.trim().split('\n')[0] ?? '');
      if (text.startsWith('SELECT id FROM schema_migrations')) {
        return { rows: applied.map((id) => ({ id })) };
      }
      return { rows: [] };
    },
  };
  return { client, statements };
}

describe('runMigrations', () => {
  it('applies only migrations that are still pending', async () => {
    const { client, statements } = fakeClient(['001']);
    const executed = await runMigrations(client, [
      { id: '001', sql: 'CREATE TABLE a ()' },
      { id: '002', sql: 'CREATE TABLE b ()' },
    ]);

    expect(executed).toEqual(['002']);
    expect(statements).toContain('CREATE TABLE b ()');
    expect(statements).not.toContain('CREATE TABLE a ()');
  });

  it('rolls back and releases the lock when a migration fails', async () => {
    const statements: string[] = [];
    const client: Queryable = {
      async query(text) {
        statements.push(text.trim().split('\n')[0] ?? '');
        if (text.startsWith('CREATE TABLE broken')) throw new Error('syntax error');
        return { rows: [] };
      },
    };

    await expect(runMigrations(client, [{ id: '001', sql: 'CREATE TABLE broken' }])).rejects.toThrow(
      'syntax error',
    );
    expect(statements).toContain('ROLLBACK');
    expect(statements.at(-1)).toContain('pg_advisory_unlock');
  });
});
