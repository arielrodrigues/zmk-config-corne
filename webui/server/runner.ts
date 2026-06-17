import type { Request, Response } from 'express';
import { spawn } from 'node:child_process';

export type ScriptOptions = {
  script: string;
  args?: string[];
  cwd?: string;
};

export function streamScript(req: Request, res: Response, opts: ScriptOptions): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const child = spawn(opts.script, opts.args ?? [], {
    cwd: opts.cwd,
    env: process.env,
  });

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const flushLines = (stream: 'stdout' | 'stderr') => {
    let buf = '';
    return (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        send('log', { stream, line });
      }
    };
  };

  const stdoutHandler = flushLines('stdout');
  const stderrHandler = flushLines('stderr');

  child.stdout.on('data', stdoutHandler);
  child.stderr.on('data', stderrHandler);

  child.on('error', (err) => {
    send('log', { stream: 'stderr', line: `runner error: ${err.message}` });
    send('done', { exitCode: -1 });
    res.end();
  });

  child.on('close', (code) => {
    send('done', { exitCode: code ?? -1 });
    res.end();
  });

  req.on('close', () => {
    if (!child.killed) child.kill('SIGTERM');
  });
}
