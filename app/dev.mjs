import { build } from 'esbuild';
import { spawn } from 'node:child_process';

await build({
  entryPoints: { index: 'src/local/server.ts' },
  outdir: 'dist/local',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['pg-native'],
  loader: { '.sql': 'text' },
  logLevel: 'warning',
});

const server = spawn(process.execPath, ['--enable-source-maps', 'dist/local/index.js'], {
  stdio: 'inherit',
});

server.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
