import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';
import { parseKeymap, tokenizeBindings } from './keymap.js';

const REAL_KEYMAP = path.join(REPO_ROOT, 'config', 'corne.keymap');

describe('tokenizeBindings', () => {
  it('parses a mix of arities', () => {
    const input =
      '&kp Q  &kp W  &trans  &none  &mo NAV_L  &bt BT_SEL 0  &bt BT_CLR  &rgb_ug RGB_TOG';
    const out = tokenizeBindings(input);
    expect(out.map((b) => b.behavior)).toEqual([
      '&kp',
      '&kp',
      '&trans',
      '&none',
      '&mo',
      '&bt',
      '&bt',
      '&rgb_ug',
    ]);
    expect(out[5].args).toEqual(['BT_SEL', '0']);
    expect(out[6].args).toEqual(['BT_CLR']);
    expect(out[7].args).toEqual(['RGB_TOG']);
  });

  it('handles whitespace-only input', () => {
    expect(tokenizeBindings('   \n  ')).toEqual([]);
  });

  it('preserves an unknown behavior verbatim', () => {
    const out = tokenizeBindings('&weird ARG1 ARG2');
    expect(out[0].behavior).toBe('&weird');
    expect(out[0].args).toEqual(['ARG1', 'ARG2']);
  });
});

describe('parseKeymap on the real corne.keymap', () => {
  const text = fs.readFileSync(REAL_KEYMAP, 'utf8');
  const km = parseKeymap(text);

  it('finds four layers', () => {
    expect(km.layers.map((l) => l.name)).toEqual([
      'default_layer',
      'nav_layer',
      'sym_layer',
      'adj_layer',
    ]);
  });

  it('extracts the right display names', () => {
    const names = km.layers.map((l) => l.displayName);
    expect(names).toEqual(['Base', 'Nav', 'Sym', 'Adj']);
  });

  it('has 42 bindings per layer (Corne)', () => {
    for (const layer of km.layers) {
      expect(layer.bindings.length, `${layer.name} binding count`).toBe(42);
    }
  });

  it('preserves Q on Base layer position 1', () => {
    const base = km.layers[0];
    expect(base.bindings[1]).toMatchObject({ behavior: '&kp', args: ['Q'] });
  });

  it('finds the three combos with the right key positions', () => {
    const names = km.combos.map((c) => c.name);
    expect(names).toContain('combo_studio_unlock');
    expect(names).toContain('combo_bootloader_left');
    expect(names).toContain('combo_bootloader_right');

    const studio = km.combos.find((c) => c.name === 'combo_studio_unlock')!;
    expect(studio.keyPositions).toEqual([38, 39]);
    expect(studio.bindings[0]).toMatchObject({ behavior: '&studio_unlock' });
    expect(studio.layers).toEqual([0]);

    const leftBoot = km.combos.find((c) => c.name === 'combo_bootloader_left')!;
    expect(leftBoot.keyPositions).toEqual([0, 24]);
  });

  it('Adj-layer H/J/K/L map to the RGB bindings', () => {
    const adj = km.layers[3];
    // Right half home row starts at position 18 (H, J, K, L, ;, ENT).
    expect(adj.bindings[18]).toMatchObject({ behavior: '&rgb_ug', args: ['RGB_TOG'] });
    expect(adj.bindings[19]).toMatchObject({ behavior: '&rgb_ug', args: ['RGB_EFF'] });
    expect(adj.bindings[20]).toMatchObject({ behavior: '&rgb_ug', args: ['RGB_BRD'] });
    expect(adj.bindings[21]).toMatchObject({ behavior: '&rgb_ug', args: ['RGB_BRI'] });
  });

  it('Nav-layer left thumb keys are &trans, ADJ activator on left thumb', () => {
    const nav = km.layers[1];
    // Thumbs are positions 36..41. NAV layer triggers ADJ on position 36 (right thumb-inner-left
    // in the layout; in the bindings array it's the first of the six thumb bindings).
    const thumbs = nav.bindings.slice(36, 42);
    expect(thumbs.find((b) => b.behavior === '&mo' && b.args[0] === 'ADJ_L')).toBeTruthy();
  });
});
