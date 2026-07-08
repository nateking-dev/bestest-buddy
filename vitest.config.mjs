import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The obsidian package is type-declarations only; give value imports a stub.
      obsidian: new URL('./tests/mocks/obsidian.ts', import.meta.url).pathname,
    },
  },
  test: {
    // Only our source tests — ignore any stale build outputs (dist/, dist-server/).
    include: ['tests/**/*.test.ts'],
  },
});
