import { describe, expect, it } from 'vitest';
import { watchIgnored } from '../vite.config';

const worktreeFile = 'D:/Web Tank/.worktrees/038/src/main.ts';

describe('Vite watcher ignored paths', () => {
  it('ignores worktrees nested under the main repository root', () => {
    expect(watchIgnored('D:/Web Tank').some((pattern) => pattern.test(worktreeFile))).toBe(true);
  });

  it('does not ignore project files when the server runs in a worktree', () => {
    expect(watchIgnored('D:/Web Tank/.worktrees/038').some((pattern) => pattern.test(worktreeFile))).toBe(false);
  });
});
