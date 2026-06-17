import type { DocContent, DocSummary } from './types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listDocs: () => getJson<{ items: DocSummary[] }>('/api/docs'),
  getDoc: (slug: string) => getJson<DocContent>(`/api/docs/${encodeURIComponent(slug)}`),
};
