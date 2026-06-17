// Parser for ZMK devicetree keymap files. Read-only for Phase 5a; surgical
// editing comes in Phase 5b.
//
// The parser is intentionally conservative — it only knows how to tokenize
// bindings into a {behavior, args} shape and to find the layers + combos
// blocks. Anything it can't recognize is preserved as a "raw" binding so it
// still shows up in the viewer.

export type Binding = {
  behavior: string;
  args: string[];
  raw: string;
};

export type Layer = {
  name: string;
  displayName: string;
  bindings: Binding[];
};

export type Combo = {
  name: string;
  timeoutMs: number;
  keyPositions: number[];
  bindings: Binding[];
  layers?: number[];
};

export type Keymap = {
  layers: Layer[];
  combos: Combo[];
  raw: string;
};

// Strip /* ... */ and // ... comments so they don't interfere with our regexes.
// Preserve string contents and devicetree-style label colons.
function stripComments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const a = text[i];
    const b = text[i + 1];
    if (a === '/' && b === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
      continue;
    }
    if (a === '/' && b === '/') {
      const end = text.indexOf('\n', i + 2);
      i = end < 0 ? text.length : end;
      continue;
    }
    out += a;
    i++;
  }
  return out;
}

// Find a balanced { ... } block starting at openIdx (which points to '{').
// Returns the index just after the matching '}'.
function endOfBlock(text: string, openIdx: number): number {
  if (text[openIdx] !== '{') throw new Error('endOfBlock expected {');
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('Unbalanced braces');
}

// Tokenize a bindings = <...>; block contents into Binding[].
// Bindings are written as `&behavior arg1 arg2 ... &nextBehavior ...`.
// We split on `&` and parse each chunk.
export function tokenizeBindings(inner: string): Binding[] {
  const trimmed = inner.trim();
  if (!trimmed) return [];
  const bindings: Binding[] = [];
  const parts = trimmed.split('&').slice(1); // first split is empty (or pre-& text)
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const behavior = '&' + tokens[0];
    const args = tokens.slice(1);
    bindings.push({ behavior, args, raw: ('&' + tokens.join(' ')).trim() });
  }
  return bindings;
}

// Extract <...> contents after a given property name within a block.
function extractAngleProperty(block: string, prop: string): string | null {
  const re = new RegExp(`${prop}\\s*=\\s*<([^>]*)>\\s*;`, 'm');
  const m = block.match(re);
  return m ? m[1] : null;
}

function extractStringProperty(block: string, prop: string): string | null {
  const re = new RegExp(`${prop}\\s*=\\s*"([^"]*)"\\s*;`, 'm');
  const m = block.match(re);
  return m ? m[1] : null;
}

function parseInts(angle: string, defines?: Map<string, number>): number[] {
  return angle
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const n = Number(t);
      if (Number.isFinite(n)) return n;
      const def = defines?.get(t);
      return def !== undefined ? def : NaN;
    })
    .filter((n) => Number.isFinite(n));
}

function collectDefines(text: string): Map<string, number> {
  const defines = new Map<string, number>();
  const re = /^\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+(-?\d+)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    defines.set(m[1], Number(m[2]));
  }
  return defines;
}

// Find all child blocks of the form `name { ... };` inside `keymap { ... }`.
function findChildBlocks(parent: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(parent)) !== null) {
    const openIdx = m.index + m[0].length - 1; // index of '{'
    if (openIdx < 0) continue;
    const closeIdx = endOfBlock(parent, openIdx);
    const body = parent.slice(openIdx + 1, closeIdx - 1);
    out.push({ name: m[1], body });
    re.lastIndex = closeIdx; // skip past
  }
  return out;
}

export function parseKeymap(text: string): Keymap {
  const clean = stripComments(text);
  const defines = collectDefines(text);

  // Locate the `keymap { ... }` block and the `combos { ... }` block.
  const keymapMatch = clean.match(/keymap\s*\{/);
  if (!keymapMatch) {
    return { layers: [], combos: [], raw: text };
  }
  const kmOpen = keymapMatch.index! + keymapMatch[0].length - 1;
  const kmEnd = endOfBlock(clean, kmOpen);
  const kmBody = clean.slice(kmOpen + 1, kmEnd - 1);

  const layers: Layer[] = [];
  for (const child of findChildBlocks(kmBody)) {
    const bindingsAngle = extractAngleProperty(child.body, 'bindings');
    if (bindingsAngle === null) continue;
    const displayName = extractStringProperty(child.body, 'display-name') ?? child.name;
    layers.push({
      name: child.name,
      displayName,
      bindings: tokenizeBindings(bindingsAngle),
    });
  }

  const combos: Combo[] = [];
  const combosMatch = clean.match(/combos\s*\{/);
  if (combosMatch) {
    const cOpen = combosMatch.index! + combosMatch[0].length - 1;
    const cEnd = endOfBlock(clean, cOpen);
    const cBody = clean.slice(cOpen + 1, cEnd - 1);
    for (const child of findChildBlocks(cBody)) {
      // Skip `compatible = "zmk,combos";` and similar non-combo properties.
      const positionsAngle = extractAngleProperty(child.body, 'key-positions');
      const bindingsAngle = extractAngleProperty(child.body, 'bindings');
      if (positionsAngle === null || bindingsAngle === null) continue;
      const timeoutAngle = extractAngleProperty(child.body, 'timeout-ms');
      const layersAngle = extractAngleProperty(child.body, 'layers');
      combos.push({
        name: child.name,
        timeoutMs: timeoutAngle !== null ? parseInts(timeoutAngle, defines)[0] ?? 0 : 0,
        keyPositions: parseInts(positionsAngle, defines),
        bindings: tokenizeBindings(bindingsAngle),
        layers: layersAngle !== null ? parseInts(layersAngle, defines) : undefined,
      });
    }
  }

  return { layers, combos, raw: text };
}
