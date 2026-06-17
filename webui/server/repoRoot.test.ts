import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './repoRoot.js';

describe('repoRoot', () => {
  it('resolves to a directory containing config/corne.keymap', () => {
    const keymap = path.join(REPO_ROOT, 'config', 'corne.keymap');
    expect(fs.existsSync(keymap)).toBe(true);
  });

  it('resolves to a directory containing the rebuild script', () => {
    const rebuild = path.join(REPO_ROOT, 'rebuild');
    expect(fs.existsSync(rebuild)).toBe(true);
  });
});
