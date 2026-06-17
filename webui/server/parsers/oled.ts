// Parser for the LVGL OLED screen source file (custom_status_screen.c).
//
// We never re-emit the whole file — we keep the raw text and splice in
// replacements for specific anchored regions. That way comments, formatting,
// LVGL boilerplate, and anything else in the file survives untouched.

export type OLEDConstants = {
  loveTimeoutMs: number;
  fastWpm: number;
  loveText: string;
  vampireFrames: {
    idle: string;
    left: string;
    right: string;
    fast: string;
  };
};

const DEFINE_LOVE = /^[ \t]*#define[ \t]+LOVE_TIMEOUT_MS[ \t]+(\d+)/m;
const DEFINE_FAST = /^[ \t]*#define[ \t]+FAST_WPM[ \t]+(\d+)/m;
const LOVE_LABEL =
  /lv_label_set_text\(\s*love_label\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/;
const VAMP_RE = (name: 'IDLE' | 'LEFT' | 'RIGHT' | 'FAST') =>
  new RegExp(
    `(static\\s+const\\s+char\\s+VAMP_${name}\\s*\\[\\s*\\]\\s*=\\s*)"((?:[^"\\\\]|\\\\.)*)"(\\s*;)`,
  );

// Decode a C-style escaped string literal body into a real string.
export function decodeCString(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const next = s[++i];
    switch (next) {
      case 'n':
        out += '\n';
        break;
      case 't':
        out += '\t';
        break;
      case 'r':
        out += '\r';
        break;
      case '\\':
        out += '\\';
        break;
      case '"':
        out += '"';
        break;
      case "'":
        out += "'";
        break;
      case '0':
        out += '\0';
        break;
      default:
        // Pass through unknown escapes verbatim.
        out += '\\' + (next ?? '');
    }
  }
  return out;
}

// Re-encode a real string as a C string literal body (without surrounding quotes).
export function encodeCString(s: string): string {
  let out = '';
  for (const c of s) {
    if (c === '\\') out += '\\\\';
    else if (c === '"') out += '\\"';
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\t') out += '\\t';
    else out += c;
  }
  return out;
}

function mustExtract<T>(re: RegExp, text: string, label: string, decode: (raw: string) => T): T {
  const m = text.match(re);
  if (!m) throw new Error(`Could not find ${label} in custom_status_screen.c`);
  return decode(m[1]);
}

function extractVamp(text: string, name: 'IDLE' | 'LEFT' | 'RIGHT' | 'FAST'): string {
  const m = text.match(VAMP_RE(name));
  if (!m) throw new Error(`Could not find VAMP_${name}`);
  return decodeCString(m[2]);
}

export function parseOLED(text: string): OLEDConstants {
  const loveTimeoutMs = mustExtract(DEFINE_LOVE, text, '#define LOVE_TIMEOUT_MS', (s) => Number(s));
  const fastWpm = mustExtract(DEFINE_FAST, text, '#define FAST_WPM', (s) => Number(s));
  const loveText = mustExtract(LOVE_LABEL, text, 'lv_label_set_text(love_label, ...)', decodeCString);
  return {
    loveTimeoutMs,
    fastWpm,
    loveText,
    vampireFrames: {
      idle: extractVamp(text, 'IDLE'),
      left: extractVamp(text, 'LEFT'),
      right: extractVamp(text, 'RIGHT'),
      fast: extractVamp(text, 'FAST'),
    },
  };
}

function spliceReplace(
  text: string,
  re: RegExp,
  builder: (match: RegExpMatchArray) => string,
  label: string,
): string {
  const m = text.match(re);
  if (!m || m.index === undefined) {
    throw new Error(`Could not find ${label} during write`);
  }
  return text.slice(0, m.index) + builder(m) + text.slice(m.index + m[0].length);
}

export function applyOLED(text: string, next: OLEDConstants): string {
  let out = text;
  out = spliceReplace(
    out,
    DEFINE_LOVE,
    (m) => m[0].replace(/\d+/, String(next.loveTimeoutMs)),
    'LOVE_TIMEOUT_MS',
  );
  out = spliceReplace(
    out,
    DEFINE_FAST,
    (m) => m[0].replace(/\d+/, String(next.fastWpm)),
    'FAST_WPM',
  );
  out = spliceReplace(
    out,
    LOVE_LABEL,
    () => `lv_label_set_text(love_label, "${encodeCString(next.loveText)}")`,
    'lv_label_set_text(love_label, ...)',
  );
  const writeVamp = (name: 'IDLE' | 'LEFT' | 'RIGHT' | 'FAST', value: string) => {
    out = spliceReplace(
      out,
      VAMP_RE(name),
      (m) => `${m[1]}"${encodeCString(value)}"${m[3]}`,
      `VAMP_${name}`,
    );
  };
  writeVamp('IDLE', next.vampireFrames.idle);
  writeVamp('LEFT', next.vampireFrames.left);
  writeVamp('RIGHT', next.vampireFrames.right);
  writeVamp('FAST', next.vampireFrames.fast);
  return out;
}
