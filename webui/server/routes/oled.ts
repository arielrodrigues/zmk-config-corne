import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';
import { applyOLED, parseOLED, type OLEDConstants } from '../parsers/oled.js';

const OLED_PATH = path.join(REPO_ROOT, 'config', 'custom_status_screen.c');

async function atomicWrite(target: string, content: string): Promise<void> {
  const tmp = `${target}.tmp.${process.pid}`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, target);
}

// Phase 3 edits the timing constants and love text. Vampire frames come in
// Phase 4 — but the parser already handles them, so we accept them on PUT
// and preserve them through the round-trip.
function validate(c: OLEDConstants): string | null {
  if (!Number.isFinite(c.loveTimeoutMs) || c.loveTimeoutMs < 0 || c.loveTimeoutMs > 600000)
    return 'loveTimeoutMs must be 0..600000';
  if (!Number.isFinite(c.fastWpm) || c.fastWpm < 0 || c.fastWpm > 500)
    return 'fastWpm must be 0..500';
  if (typeof c.loveText !== 'string') return 'loveText must be a string';
  for (const [name, frame] of Object.entries(c.vampireFrames)) {
    if (typeof frame !== 'string') return `vampireFrames.${name} must be a string`;
  }
  return null;
}

export const oledRouter = express.Router();

oledRouter.get('/', async (_req, res) => {
  try {
    const raw = await fs.readFile(OLED_PATH, 'utf8');
    res.json({ ...parseOLED(raw), raw });
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'OLED_READ_FAILED' } });
  }
});

oledRouter.put('/', async (req, res) => {
  const body = req.body as OLEDConstants | undefined;
  if (!body) {
    res.status(400).json({ error: { message: 'Missing body', code: 'BAD_BODY' } });
    return;
  }
  const verr = validate(body);
  if (verr) {
    res.status(400).json({ error: { message: verr, code: 'VALIDATION' } });
    return;
  }
  try {
    const raw = await fs.readFile(OLED_PATH, 'utf8');
    const next = applyOLED(raw, body);
    await atomicWrite(OLED_PATH, next);
    res.json({ ...parseOLED(next), raw: next });
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'OLED_WRITE_FAILED' } });
  }
});

oledRouter.post('/preview', async (req, res) => {
  const body = req.body as OLEDConstants | undefined;
  if (!body) {
    res.status(400).json({ error: { message: 'Missing body', code: 'BAD_BODY' } });
    return;
  }
  const verr = validate(body);
  if (verr) {
    res.status(400).json({ error: { message: verr, code: 'VALIDATION' } });
    return;
  }
  try {
    const raw = await fs.readFile(OLED_PATH, 'utf8');
    const next = applyOLED(raw, body);
    res.json({ before: raw, after: next });
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'OLED_PREVIEW_FAILED' } });
  }
});
