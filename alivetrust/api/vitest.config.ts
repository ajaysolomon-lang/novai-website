import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['../tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
    },
  },
  resolve: {
    alias: {
      '@': '/home/user/novai-website/alivetrust/api/src',
    },
  },
});
