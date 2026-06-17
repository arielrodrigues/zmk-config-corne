import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';
import {
  applyOLED,
  decodeCString,
  encodeCString,
  parseOLED,
} from './oled.js';

const REAL_OLED = path.join(REPO_ROOT, 'config', 'custom_status_screen.c');

describe('OLED C-string codec', () => {
  it('round-trips a string containing the tricky escapes', () => {
    const orig = ' /v_v\\ \n( o.o )\n )   ( \n  | |  ';
    const reencoded = encodeCString(orig);
    expect(decodeCString(reencoded)).toBe(orig);
  });

  it('handles quotes and backslashes', () => {
    const orig = 'he said "hello\\world"';
    expect(decodeCString(encodeCString(orig))).toBe(orig);
  });
});

describe('parseOLED / applyOLED', () => {
  it('reads the real custom_status_screen.c', () => {
    const text = fs.readFileSync(REAL_OLED, 'utf8');
    const c = parseOLED(text);
    expect(c.loveTimeoutMs).toBeGreaterThan(0);
    expect(c.fastWpm).toBeGreaterThan(0);
    expect(typeof c.loveText).toBe('string');
    expect(c.vampireFrames.idle).toContain('\n');
    expect(c.vampireFrames.idle.split('\n')).toHaveLength(4);
  });

  it('round-trips byte-identical when nothing changes', () => {
    const text = fs.readFileSync(REAL_OLED, 'utf8');
    const c = parseOLED(text);
    const out = applyOLED(text, c);
    expect(out).toBe(text);
  });

  it('mutating loveText only changes the lv_label_set_text line', () => {
    const text = fs.readFileSync(REAL_OLED, 'utf8');
    const c = parseOLED(text);
    const next = applyOLED(text, { ...c, loveText: 'new message!' });
    expect(next).not.toBe(text);
    const reparsed = parseOLED(next);
    expect(reparsed.loveText).toBe('new message!');
    // Other fields preserved.
    expect(reparsed.loveTimeoutMs).toBe(c.loveTimeoutMs);
    expect(reparsed.fastWpm).toBe(c.fastWpm);
    expect(reparsed.vampireFrames).toEqual(c.vampireFrames);
  });

  it('mutating LOVE_TIMEOUT_MS only touches that line', () => {
    const text = fs.readFileSync(REAL_OLED, 'utf8');
    const c = parseOLED(text);
    const next = applyOLED(text, { ...c, loveTimeoutMs: 30000 });
    const reparsed = parseOLED(next);
    expect(reparsed.loveTimeoutMs).toBe(30000);
    // The only line difference should be the LOVE_TIMEOUT_MS line.
    const beforeLines = text.split('\n');
    const afterLines = next.split('\n');
    const diffs = beforeLines.map((l, i) => [l, afterLines[i]]).filter(([a, b]) => a !== b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0][1]).toContain('LOVE_TIMEOUT_MS');
    expect(diffs[0][1]).toContain('30000');
  });

  it('mutating a vampire frame preserves the original spacing of the line', () => {
    const text = fs.readFileSync(REAL_OLED, 'utf8');
    const c = parseOLED(text);
    const newFrame = ' /^_^\\ \n( o.o )\n )   ( \n  / \\  ';
    const next = applyOLED(text, {
      ...c,
      vampireFrames: { ...c.vampireFrames, idle: newFrame },
    });
    expect(parseOLED(next).vampireFrames.idle).toBe(newFrame);
    // The line containing VAMP_IDLE must keep its `[]  =` (two-space) spacing.
    const idleLine = next.split('\n').find((l) => l.includes('VAMP_IDLE'));
    expect(idleLine).toBeDefined();
    expect(idleLine).toMatch(/VAMP_IDLE\[\]\s+=/);
  });

  it('reports a clear error if a required anchor is missing', () => {
    const broken = '// no constants here';
    expect(() => parseOLED(broken)).toThrow(/LOVE_TIMEOUT_MS/);
  });
});
