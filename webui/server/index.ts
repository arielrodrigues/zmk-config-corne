import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { docsRouter } from './routes/docs.js';
import { buildRouter } from './routes/build.js';
import { REPO_ROOT } from './repoRoot.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, repoRoot: REPO_ROOT });
});

app.use('/api/docs', docsRouter);
app.use('/api', buildRouter);

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
