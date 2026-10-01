/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    watch: {
      ignored: ['.worktrees/**', 'Archive/**', '**/.worktrees/**', '**/Archive/**'],
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '.worktrees/**', 'Archive/**'],
  },
});

