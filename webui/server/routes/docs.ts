import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';

const DOCS_DIR = path.join(REPO_ROOT, 'webui', 'docs');

type Frontmatter = {
  slug?: string;
  title?: string;
  group?: string;
  order?: number;
};

function parseFrontmatter(text: string): { meta: Frontmatter; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const meta: Frontmatter = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k === 'order') meta.order = Number(v);
    else if (k === 'slug') meta.slug = v;
    else if (k === 'title') meta.title = v;
    else if (k === 'group') meta.group = v;
  }
  return { meta, body: match[2] };
}

export const docsRouter = express.Router();

docsRouter.get('/', async (_req, res) => {
  try {
    const files = (await fs.readdir(DOCS_DIR)).filter((f) => f.endsWith('.md'));
    const items: Array<{ slug: string; title: string; group: string; order: number }> = [];
    for (const f of files) {
      const text = await fs.readFile(path.join(DOCS_DIR, f), 'utf8');
      const { meta } = parseFrontmatter(text);
      if (meta.slug && meta.title) {
        items.push({
          slug: meta.slug,
          title: meta.title,
          group: meta.group ?? 'Docs',
          order: meta.order ?? 999,
        });
      }
    }
    items.sort((a, b) => a.order - b.order);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'DOCS_LIST_FAILED' } });
  }
});

docsRouter.get('/:slug', async (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9-]/gi, '');
  if (!slug) {
    res.status(400).json({ error: { message: 'Invalid slug', code: 'BAD_SLUG' } });
    return;
  }
  const file = path.join(DOCS_DIR, `${slug}.md`);
  try {
    const text = await fs.readFile(file, 'utf8');
    const { meta, body } = parseFrontmatter(text);
    res.json({ slug: meta.slug ?? slug, title: meta.title ?? slug, markdown: body });
  } catch {
    res.status(404).json({ error: { message: 'Doc not found', code: 'NOT_FOUND' } });
  }
});
