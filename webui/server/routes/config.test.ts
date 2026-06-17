import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseKconfig, getSetting } from '../parsers/kconfig.js';
import { REPO_ROOT } from '../repoRoot.js';

// We cannot call the express handler directly without spinning up a server,
// but we can verify the parser-level invariant the route relies on: that
// applying an RGB mutation does not touch unrelated settings.
//
// Mirrors the route's applyRGB logic in a minimal form.
import {
  setSetting,
  serializeKconfig,
} from '../parsers/kconfig.js';

const REAL_CONF = path.join(REPO_ROOT, 'config', 'corne.conf');

describe('config route invariants', () => {
  it('mutating RGB keeps every other CONFIG_ line byte-identical', () => {
    const raw = fs.readFileSync(REAL_CONF, 'utf8');
    const before = parseKconfig(raw);
    const after = parseKconfig(raw);

    // Mutate one RGB setting; nothing else.
    setSetting(after, 'CONFIG_ZMK_RGB_UNDERGLOW_BRT_START', '17');

    // All non-RGB settings should match exactly.
    for (const line of before.lines) {
      if (line.kind !== 'setting') continue;
      if (line.key.startsWith('CONFIG_ZMK_RGB_UNDERGLOW')) continue;
      expect(getSetting(after, line.key)).toBe(line.value);
    }
    // Serialization differs only in the one line we changed.
    const beforeText = serializeKconfig(before);
    const afterText = serializeKconfig(after);
    const beforeLines = beforeText.split('\n');
    const afterLines = afterText.split('\n');
    const diffs = beforeLines
      .map((l, i) => [l, afterLines[i]])
      .filter(([a, b]) => a !== b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0][0]).toMatch(/^CONFIG_ZMK_RGB_UNDERGLOW_BRT_START=/);
    expect(diffs[0][1]).toBe('CONFIG_ZMK_RGB_UNDERGLOW_BRT_START=17');
  });
});
