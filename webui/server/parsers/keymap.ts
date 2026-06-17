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
// When preservePositions is true, comments are replaced by spaces/newlines of
// the same byte length so character offsets line up with the original text —
// used by the surgical editor in editKeymap().
function stripComments(text: string, preservePositions = false): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const a = text[i];
    const b = text[i + 1];
    if (a === '/' && b === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      if (preservePositions) {
        for (let j = i; j < stop; j++) out += text[j] === '\n' ? '\n' : ' ';
      }
      i = stop;
      continue;
    }
    if (a === '/' && b === '/') {
      const end = text.indexOf('\n', i + 2);
      const stop = end < 0 ? text.length : end;
      if (preservePositions) {
        for (let j = i; j < stop; j++) out += ' ';
      }
      i = stop;
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

// Surgical editor — replaces specific bindings without re-emitting the file.
// `edits` is a list of (layer name, position, newBindingText) tuples.
// Returns the new file content with the edits applied. The rest of the file
// stays byte-identical — comments, formatting, combos, and unknown nodes are
// preserved.
export type KeymapEdit = {
  layer: string;        // layer node name, e.g. 'adj_layer'
  position: number;     // 0..n-1 (Corne: 0..41)
  newBinding: string;   // e.g. '&kp Q' or '&rgb_ug RGB_TOG'
};

function findBindingRange(
  raw: string,
  rangeStart: number,
  rangeEnd: number,
  position: number,
): { start: number; end: number } {
  // Within raw[rangeStart..rangeEnd) (the contents of bindings = <...>),
  // find the substring covering binding at index `position`.
  // A binding starts at the next `&` and ends just before the following `&` or
  // the end of the range.
  let idx = 0;
  let i = rangeStart;
  let bindingStart = -1;
  let bindingEnd = -1;
  while (i < rangeEnd) {
    if (raw[i] === '&') {
      if (idx === position) {
        bindingStart = i;
        // Walk forward to find the end of this binding (next & or end).
        let j = i + 1;
        while (j < rangeEnd && raw[j] !== '&') j++;
        // Trim trailing whitespace from the binding span.
        while (j > i + 1 && /\s/.test(raw[j - 1])) j--;
        bindingEnd = j;
        break;
      }
      idx++;
      i++;
    } else {
      i++;
    }
  }
  if (bindingStart < 0) {
    throw new Error(`Position ${position} not found (only ${idx} bindings seen)`);
  }
  return { start: bindingStart, end: bindingEnd };
}

function findLayerBindingsRange(
  raw: string,
  layerNodeName: string,
): { contentStart: number; contentEnd: number } {
  // Use comment-stripped (positions preserved) view to find structural markers.
  const view = stripComments(raw, true);
  const layerRe = new RegExp(`${layerNodeName}\\s*\\{`);
  const layerMatch = view.match(layerRe);
  if (!layerMatch || layerMatch.index === undefined) {
    throw new Error(`Layer "${layerNodeName}" not found`);
  }
  const openIdx = layerMatch.index + layerMatch[0].length - 1;
  const closeIdx = endOfBlock(view, openIdx);

  // Find `bindings = <` inside [openIdx, closeIdx).
  const slice = view.slice(openIdx, closeIdx);
  const bm = slice.match(/bindings\s*=\s*</);
  if (!bm || bm.index === undefined) {
    throw new Error(`Layer "${layerNodeName}" has no bindings block`);
  }
  const ltStart = openIdx + bm.index + bm[0].length; // index just after '<'
  const gtIdx = view.indexOf('>', ltStart);
  if (gtIdx < 0 || gtIdx >= closeIdx) {
    throw new Error(`Could not find closing > for ${layerNodeName} bindings`);
  }
  return { contentStart: ltStart, contentEnd: gtIdx };
}

export function editKeymap(text: string, edits: KeymapEdit[]): string {
  if (edits.length === 0) return text;

  // Apply edits in descending order of absolute start position so earlier
  // splices don't invalidate later offsets.
  type Splice = { start: number; end: number; replacement: string };
  const splices: Splice[] = [];
  for (const e of edits) {
    const { contentStart, contentEnd } = findLayerBindingsRange(text, e.layer);
    const { start, end } = findBindingRange(text, contentStart, contentEnd, e.position);
    splices.push({ start, end, replacement: e.newBinding.trim() });
  }
  splices.sort((a, b) => b.start - a.start);

  let out = text;
  for (const s of splices) {
    out = out.slice(0, s.start) + s.replacement + out.slice(s.end);
  }
  return out;
}
