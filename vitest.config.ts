import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'lib/auth.ts',
        'lib/grading.ts',
        'lib/jwt.ts',
        'lib/relay-store.ts',
        'lib/sessionCache.ts',
        'lib/slugify.ts',
      ],
      reporter: ['text', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
