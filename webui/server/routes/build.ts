import express from 'express';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.js';
import { streamScript } from '../runner.js';

export const buildRouter = express.Router();

buildRouter.post('/rebuild', (req, res) => {
  streamScript(req, res, {
    script: path.join(REPO_ROOT, 'rebuild'),
    cwd: REPO_ROOT,
  });
});

buildRouter.post('/generate-kle', (req, res) => {
  streamScript(req, res, {
    script: path.join(REPO_ROOT, 'generate-kle'),
    cwd: REPO_ROOT,
  });
});

buildRouter.get('/artifacts', (_req, res) => {
  res.json({
    left: path.join(REPO_ROOT, 'build', 'corne_left', 'zephyr', 'zmk.uf2'),
    right: path.join(REPO_ROOT, 'build', 'corne_right', 'zephyr', 'zmk.uf2'),
    settingsReset: path.join(REPO_ROOT, 'build', 'settings_reset', 'zephyr', 'zmk.uf2'),
  });
});
