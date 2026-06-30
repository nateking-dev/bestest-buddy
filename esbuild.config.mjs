import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import process from 'node:process';

const production = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: production ? false : 'inline',
  minify: production,
  logLevel: 'info',
  outfile: 'main.js',
  external: ['obsidian', 'electron', ...builtins],
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
