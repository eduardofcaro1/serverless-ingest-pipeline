import { defineConfig } from 'vitest/config';

const sqlAsText = {
  name: 'sql-as-text',
  transform(code: string, id: string) {
    if (id.endsWith('.sql')) {
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    }
    return null;
  },
};

export default defineConfig({
  plugins: [sqlAsText],
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
