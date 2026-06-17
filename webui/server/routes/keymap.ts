import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';
import { editKeymap, parseKeymap, type KeymapEdit } from '../parsers/keymap.js';

const KEYMAP_PATH = path.join(REPO_ROOT, 'config', 'corne.keymap');

async function atomicWrite(target: string, content: string): Promise<void> {
  const tmp = `${target}.tmp.${process.pid}`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, target);
}

function validateEdits(edits: unknown): KeymapEdit[] | string {
  if (!Array.isArray(edits)) return 'edits must be an array';
  const out: KeymapEdit[] = [];
  for (const e of edits) {
    if (!e || typeof e !== 'object') return 'each edit must be an object';
    const layer = (e as { layer?: unknown }).layer;
    const position = (e as { position?: unknown }).position;
    const newBinding = (e as { newBinding?: unknown }).newBinding;
    if (typeof layer !== 'string' || !/^[a-z_][a-z0-9_]*$/i.test(layer))
      return 'edit.layer must be a valid identifier';
    if (typeof position !== 'number' || !Number.isInteger(position) || position < 0)
      return 'edit.position must be a non-negative integer';
    if (typeof newBinding !== 'string' || !/^&[A-Za-z_][A-Za-z0-9_]*/.test(newBinding.trim()))
      return 'edit.newBinding must start with `&behavior`';
    out.push({ layer, position, newBinding });
  }
  return out;
}

export const keymapRouter = express.Router();

keymapRouter.get('/', async (_req, res) => {
  try {
    const raw = await fs.readFile(KEYMAP_PATH, 'utf8');
    res.json(parseKeymap(raw));
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'KEYMAP_READ_FAILED' } });
  }
});

keymapRouter.post('/preview', async (req, res) => {
  const body = req.body as { edits?: unknown } | undefined;
  const v = validateEdits(body?.edits);
  if (typeof v === 'string') {
    res.status(400).json({ error: { message: v, code: 'VALIDATION' } });
    return;
  }
  try {
    const raw = await fs.readFile(KEYMAP_PATH, 'utf8');
    const next = editKeymap(raw, v);
    res.json({ before: raw, after: next });
  } catch (err) {
    res.status(400).json({ error: { message: String(err), code: 'KEYMAP_EDIT_FAILED' } });
  }
});

keymapRouter.put('/', async (req, res) => {
  const body = req.body as { edits?: unknown } | undefined;
  const v = validateEdits(body?.edits);
  if (typeof v === 'string') {
    res.status(400).json({ error: { message: v, code: 'VALIDATION' } });
    return;
  }
  try {
    const raw = await fs.readFile(KEYMAP_PATH, 'utf8');
    const next = editKeymap(raw, v);
    await atomicWrite(KEYMAP_PATH, next);
    res.json(parseKeymap(next));
  } catch (err) {
    res.status(400).json({ error: { message: String(err), code: 'KEYMAP_WRITE_FAILED' } });
  }
});
