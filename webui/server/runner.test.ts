import { describe, it, expect } from 'vitest';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { streamScript } from './runner.js';

function writeStubScript(body: string): string {
  const file = path.join(os.tmpdir(), `runner-stub-${process.pid}-${Date.now()}.sh`);
  fs.writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
  return file;
}

function startServer(script: string): Promise<{ server: http.Server; url: string }> {
  const app = express();
  app.post('/run', (req, res) => streamScript(req, res, { script }));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('bad addr');
      resolve({ server, url: `http://127.0.0.1:${addr.port}/run` });
    });
  });
}

async function collectEvents(url: string): Promise<{ event: string; data: unknown }[]> {
  const res = await fetch(url, { method: 'POST' });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
  }
  const events: { event: string; data: unknown }[] = [];
  for (const block of buf.split('\n\n')) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    const evt = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? '';
    const data = lines.find((l) => l.startsWith('data: '))?.slice(6) ?? '';
    events.push({ event: evt, data: JSON.parse(data) });
  }
  return events;
}

describe('streamScript', () => {
  it('streams stdout lines and a done event with exit code 0', async () => {
    const script = writeStubScript('echo "hello"\necho "world"\nexit 0');
    const { server, url } = await startServer(script);
    try {
      const events = await collectEvents(url);
      const logs = events.filter((e) => e.event === 'log').map((e) => e.data as { line: string });
      expect(logs.map((l) => l.line)).toEqual(['hello', 'world']);
      const done = events.find((e) => e.event === 'done');
      expect(done?.data).toEqual({ exitCode: 0 });
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      fs.unlinkSync(script);
    }
  });

  it('captures stderr and reports non-zero exit code', async () => {
    const script = writeStubScript('echo "oops" >&2\nexit 3');
    const { server, url } = await startServer(script);
    try {
      const events = await collectEvents(url);
      const stderr = events.filter(
        (e) => e.event === 'log' && (e.data as { stream: string }).stream === 'stderr',
      );
      expect(stderr).toHaveLength(1);
      expect((stderr[0].data as { line: string }).line).toBe('oops');
      const done = events.find((e) => e.event === 'done');
      expect(done?.data).toEqual({ exitCode: 3 });
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      fs.unlinkSync(script);
    }
  });
});
