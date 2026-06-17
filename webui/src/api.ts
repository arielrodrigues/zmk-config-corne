import type {
  ConfigDiff,
  ConfigPayload,
  DocContent,
  DocSummary,
  Keymap,
  OLEDConstants,
  OLEDPayload,
  RGBConfig,
} from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function sendJson<T>(url: string, method: 'PUT' | 'POST', body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // fall through with raw text
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listDocs: () => getJson<{ items: DocSummary[] }>('/api/docs'),
  getDoc: (slug: string) => getJson<DocContent>(`/api/docs/${encodeURIComponent(slug)}`),
  getConfig: () => getJson<ConfigPayload>('/api/config'),
  saveConfig: (rgb: RGBConfig) => sendJson<ConfigPayload>('/api/config', 'PUT', { rgb }),
  previewConfig: (rgb: RGBConfig) => sendJson<ConfigDiff>('/api/config/preview', 'POST', { rgb }),
  getOLED: () => getJson<OLEDPayload>('/api/oled'),
  saveOLED: (c: OLEDConstants) => sendJson<OLEDPayload>('/api/oled', 'PUT', c),
  previewOLED: (c: OLEDConstants) => sendJson<ConfigDiff>('/api/oled/preview', 'POST', c),
  getKeymap: () => getJson<Keymap>('/api/keymap'),
};
