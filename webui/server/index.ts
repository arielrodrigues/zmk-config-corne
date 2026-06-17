import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { docsRouter } from './routes/docs.js';
import { buildRouter } from './routes/build.js';
import { configRouter } from './routes/config.js';
import { oledRouter } from './routes/oled.js';
import { keymapRouter } from './routes/keymap.js';
import { REPO_ROOT } from './repoRoot.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, repoRoot: REPO_ROOT });
});

app.use('/api/docs', docsRouter);
app.use('/api/config', configRouter);
app.use('/api/oled', oledRouter);
app.use('/api/keymap', keymapRouter);
app.use('/api', buildRouter);

// In production: serve the built frontend from webui/dist (created by
// `npm run build`). In dev, Vite proxies /api to us; the frontend itself is
// served from Vite on port 5173.
const DIST_DIR = path.join(REPO_ROOT, 'webui', 'dist');
if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
  console.log(`[backend] serving production frontend from ${DIST_DIR}`);
}

const PORT = 5174;

const sanityFile = path.join(REPO_ROOT, 'config', 'corne.keymap');
if (!fs.existsSync(sanityFile)) {
  console.error(`Sanity check failed: ${sanityFile} not found.`);
  console.error('Backend must run from inside the zmk-config-corne repository.');
  process.exit(1);
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[backend] http://127.0.0.1:${PORT}  (repo: ${REPO_ROOT})`);
});
