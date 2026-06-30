import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only our source tests — ignore any stale build outputs (dist/, dist-server/).
    include: ['tests/**/*.test.ts'],
  },
});
