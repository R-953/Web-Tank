/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function watchIgnored(root: string): RegExp[] {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const rootPattern = normalizedRoot
    .split(/[\\/]/)
    .map(escapeRegex)
    .join('[/\\\\]');
  const caseInsensitive = /^[A-Za-z]:/.test(normalizedRoot) ? 'i' : '';
  return [new RegExp(`^${rootPattern}[/\\\\](?:\\.worktrees|Archive)(?:[/\\\\]|$)`, caseInsensitive)];
}

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    watch: {
      ignored: watchIgnored(decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/([A-Za-z]:\/)/, '$1')),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '.worktrees/**', 'Archive/**'],
  },
});
