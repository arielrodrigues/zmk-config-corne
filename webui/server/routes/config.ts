import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';
import {
  asBool,
  asInt,
  getSetting,
  parseKconfig,
  serializeKconfig,
  setSetting,
  unsetSetting,
} from '../parsers/kconfig.js';

const CONF_PATH = path.join(REPO_ROOT, 'config', 'corne.conf');

export type RGBConfig = {
  enabled: boolean;
  onStart: boolean;
  extPower: boolean;
  effect: number;
  hue: number;
  saturation: number;
  brightness: number;
  speed: number;
  brightnessStep?: number;
};

export type ConfigPayload = {
  rgb: RGBConfig;
  raw: string;
};

function extractRGB(raw: string): RGBConfig {
  const k = parseKconfig(raw);
  const step = getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_BRT_STEP');
  return {
    enabled: asBool(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW')),
    onStart: asBool(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_ON_START')),
    extPower: asBool(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER')),
    effect: asInt(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_EFF_START'), 0),
    hue: asInt(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_HUE_START'), 0),
    saturation: asInt(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_SAT_START'), 100),
    brightness: asInt(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_BRT_START'), 50),
    speed: asInt(getSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_SPD_START'), 1),
    brightnessStep: step !== undefined ? asInt(step, 10) : undefined,
  };
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function validateRGB(rgb: RGBConfig): string | null {
  if (rgb.effect < 0 || rgb.effect > 3) return 'effect must be 0..3';
  if (rgb.hue < 0 || rgb.hue > 359) return 'hue must be 0..359';
  if (rgb.saturation < 0 || rgb.saturation > 100) return 'saturation must be 0..100';
  if (rgb.brightness < 0 || rgb.brightness > 100) return 'brightness must be 0..100';
  if (rgb.speed < 1 || rgb.speed > 5) return 'speed must be 1..5';
  if (rgb.brightnessStep !== undefined && (rgb.brightnessStep < 1 || rgb.brightnessStep > 100))
    return 'brightnessStep must be 1..100';
  return null;
}

function applyRGB(raw: string, rgb: RGBConfig): string {
  const k = parseKconfig(raw);
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW', rgb.enabled ? 'y' : 'n');
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_ON_START', rgb.onStart ? 'y' : 'n');
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER', rgb.extPower ? 'y' : 'n');
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_EFF_START', String(clampInt(rgb.effect, 0, 3)));
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_HUE_START', String(clampInt(rgb.hue, 0, 359)));
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_SAT_START', String(clampInt(rgb.saturation, 0, 100)));
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_BRT_START', String(clampInt(rgb.brightness, 0, 100)));
  setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_SPD_START', String(clampInt(rgb.speed, 1, 5)));
  if (rgb.brightnessStep === undefined) {
    unsetSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_BRT_STEP');
  } else {
    setSetting(k, 'CONFIG_ZMK_RGB_UNDERGLOW_BRT_STEP', String(clampInt(rgb.brightnessStep, 1, 100)));
  }
  return serializeKconfig(k);
}

async function atomicWrite(target: string, content: string): Promise<void> {
  const tmp = `${target}.tmp.${process.pid}`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, target);
}

export const configRouter = express.Router();

configRouter.get('/', async (_req, res) => {
  try {
    const raw = await fs.readFile(CONF_PATH, 'utf8');
    const payload: ConfigPayload = { rgb: extractRGB(raw), raw };
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'CONFIG_READ_FAILED' } });
  }
});

configRouter.put('/', async (req, res) => {
  const body = req.body as { rgb?: RGBConfig } | undefined;
  if (!body?.rgb) {
    res.status(400).json({ error: { message: 'Missing rgb in body', code: 'BAD_BODY' } });
    return;
  }
  const validation = validateRGB(body.rgb);
  if (validation) {
    res.status(400).json({ error: { message: validation, code: 'VALIDATION' } });
    return;
  }
  try {
    const raw = await fs.readFile(CONF_PATH, 'utf8');
    const next = applyRGB(raw, body.rgb);
    await atomicWrite(CONF_PATH, next);
    const payload: ConfigPayload = { rgb: extractRGB(next), raw: next };
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'CONFIG_WRITE_FAILED' } });
  }
});

configRouter.post('/preview', async (req, res) => {
  const body = req.body as { rgb?: RGBConfig } | undefined;
  if (!body?.rgb) {
    res.status(400).json({ error: { message: 'Missing rgb in body', code: 'BAD_BODY' } });
    return;
  }
  const validation = validateRGB(body.rgb);
  if (validation) {
    res.status(400).json({ error: { message: validation, code: 'VALIDATION' } });
    return;
  }
  try {
    const raw = await fs.readFile(CONF_PATH, 'utf8');
    const next = applyRGB(raw, body.rgb);
    res.json({ before: raw, after: next });
  } catch (err) {
    res.status(500).json({ error: { message: String(err), code: 'CONFIG_PREVIEW_FAILED' } });
  }
});
