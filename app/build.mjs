import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';

const caBundle = 'certs/rds-global-bundle.pem';
if (!existsSync(caBundle)) {
  console.error(
    `Missing ${caBundle}. Download it from https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`,
  );
  process.exit(1);
}

const functions = ['ingest', 'migrate'];

await rm('dist', { recursive: true, force: true });

await Promise.all(
  functions.map((name) =>
    build({
      entryPoints: { index: `src/handlers/${name}.ts` },
      outdir: `dist/${name}`,
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      sourcemap: true,
      external: ['pg-native'],
      loader: { '.sql': 'text', '.pem': 'text' },
      logLevel: 'info',
    }),
  ),
);
