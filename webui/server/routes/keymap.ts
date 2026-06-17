import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';
import { parseKeymap } from '../parsers/keymap.js';

const KEYMAP_PATH = path.join(REPO_ROOT, 'config', 'corne.keymap');

export const keymapRouter = express.Router();

keymapRouter.get('/', async (_req, res) => {
  try {
    const raw = await fs.readFile(KEYMAP_PATH, 'utf8');
    res.json(parseKeymap(raw));
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'KEYMAP_READ_FAILED' } });
  }
});
