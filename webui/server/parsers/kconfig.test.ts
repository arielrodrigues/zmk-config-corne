import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseKconfig,
  serializeKconfig,
  getSetting,
  setSetting,
  unsetSetting,
} from './kconfig.js';
import { REPO_ROOT } from '../repoRoot.js';

const REAL_CONF = path.join(REPO_ROOT, 'config', 'corne.conf');

describe('parseKconfig / serializeKconfig', () => {
  it('round-trips the real corne.conf byte-for-byte', () => {
    const text = fs.readFileSync(REAL_CONF, 'utf8');
    const k = parseKconfig(text);
    const out = serializeKconfig(k);
    expect(out).toBe(text);
  });

  it('round-trips a minimal sample', () => {
    const text = '# header\nCONFIG_FOO=y\n\nCONFIG_BAR=42\n';
    const k = parseKconfig(text);
    expect(serializeKconfig(k)).toBe(text);
    expect(getSetting(k, 'CONFIG_FOO')).toBe('y');
    expect(getSetting(k, 'CONFIG_BAR')).toBe('42');
  });

  it('preserves unknown settings across mutation', () => {
    const text = 'CONFIG_KNOWN=y\nCONFIG_UNKNOWN_XYZ=42\n';
    const k = parseKconfig(text);
    setSetting(k, 'CONFIG_KNOWN', 'n');
    expect(getSetting(k, 'CONFIG_UNKNOWN_XYZ')).toBe('42');
    expect(serializeKconfig(k)).toBe('CONFIG_KNOWN=n\nCONFIG_UNKNOWN_XYZ=42\n');
  });

  it('preserves comments and blank lines through mutation', () => {
    const text = '# comment one\nCONFIG_A=y\n\n# comment two\nCONFIG_B=10\n';
    const k = parseKconfig(text);
    setSetting(k, 'CONFIG_A', 'n');
    setSetting(k, 'CONFIG_B', '20');
    expect(serializeKconfig(k)).toBe('# comment one\nCONFIG_A=n\n\n# comment two\nCONFIG_B=20\n');
  });

  it('appends new settings at the end', () => {
    const k = parseKconfig('CONFIG_A=y\n');
    setSetting(k, 'CONFIG_NEW', '5');
    expect(serializeKconfig(k)).toBe('CONFIG_A=y\nCONFIG_NEW=5\n');
  });

  it('removes a setting cleanly', () => {
    const k = parseKconfig('CONFIG_A=y\nCONFIG_B=2\n');
    unsetSetting(k, 'CONFIG_A');
    expect(serializeKconfig(k)).toBe('CONFIG_B=2\n');
  });

  it('treats malformed lines as preserved comments', () => {
    const text = 'CONFIG_A=y\nnot a setting\n';
    const k = parseKconfig(text);
    expect(serializeKconfig(k)).toBe(text);
  });
});
