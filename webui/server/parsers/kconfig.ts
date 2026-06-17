export type KconfigLine =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | { kind: 'setting'; key: string; value: string };

export type Kconfig = {
  lines: KconfigLine[];
};

const SETTING_RE = /^(CONFIG_[A-Z0-9_]+)=(.*)$/;

export function parseKconfig(text: string): Kconfig {
  const lines: KconfigLine[] = [];
  const split = text.split('\n');
  // If the file ends with a newline, split produces a trailing empty string;
  // drop it so we round-trip without growing a blank line.
  if (split.length > 0 && split[split.length - 1] === '') split.pop();
  for (const raw of split) {
    if (raw === '') {
      lines.push({ kind: 'blank' });
      continue;
    }
    if (raw.startsWith('#')) {
      lines.push({ kind: 'comment', text: raw });
      continue;
    }
    const m = raw.match(SETTING_RE);
    if (m) {
      lines.push({ kind: 'setting', key: m[1], value: m[2] });
    } else {
      // Unknown line — preserve as comment-shaped raw so we don't lose it.
      lines.push({ kind: 'comment', text: raw });
    }
  }
  return { lines };
}

export function serializeKconfig(k: Kconfig): string {
  const out: string[] = [];
  for (const line of k.lines) {
    if (line.kind === 'blank') out.push('');
    else if (line.kind === 'comment') out.push(line.text);
    else out.push(`${line.key}=${line.value}`);
  }
  return out.join('\n') + '\n';
}

export function getSetting(k: Kconfig, key: string): string | undefined {
  for (const line of k.lines) {
    if (line.kind === 'setting' && line.key === key) return line.value;
  }
  return undefined;
}

export function setSetting(k: Kconfig, key: string, value: string): void {
  for (const line of k.lines) {
    if (line.kind === 'setting' && line.key === key) {
      line.value = value;
      return;
    }
  }
  k.lines.push({ kind: 'setting', key, value });
}

export function unsetSetting(k: Kconfig, key: string): void {
  const idx = k.lines.findIndex((l) => l.kind === 'setting' && l.key === key);
  if (idx >= 0) k.lines.splice(idx, 1);
}

export function asBool(v: string | undefined): boolean {
  return v === 'y';
}

export function asInt(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
