import { useCallback, useEffect, useRef, useState } from 'react';
import { startSSE, type SSEController } from '../sse';

type LogLine = { stream: 'stdout' | 'stderr'; line: string };
type RunState = 'idle' | 'running' | 'done';
type Result = { exitCode: number } | null;

type Artifacts = { left: string; right: string; settingsReset: string };

function useRunner(endpoint: string) {
  const [state, setState] = useState<RunState>('idle');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<Result>(null);
  const ctrl = useRef<SSEController | null>(null);

  const start = useCallback(() => {
    setState('running');
    setLogs([]);
    setResult(null);
    ctrl.current = startSSE(endpoint, {
      onEvent: (e) => {
        if (e.event === 'log') {
          setLogs((prev) => [...prev, e.data as LogLine]);
        } else if (e.event === 'done') {
          setResult(e.data as { exitCode: number });
          setState('done');
        }
      },
      onError: (err) => {
        setLogs((prev) => [...prev, { stream: 'stderr', line: `error: ${err.message}` }]);
        setState('done');
      },
    });
  }, [endpoint]);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
  }, []);

  return { state, logs, result, start, cancel };
}

function LogView({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <pre
      ref={ref}
      style={{
        background: '#0c0f17',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 12,
        maxHeight: 360,
        overflow: 'auto',
        fontSize: 12,
        margin: '8px 0',
      }}
    >
      {lines.length === 0
        ? <span style={{ color: 'var(--fg-dim)' }}>(no output yet)</span>
        : lines.map((l, i) => (
            <div key={i} style={{ color: l.stream === 'stderr' ? 'var(--accent-2)' : 'var(--fg)' }}>
              {l.line || ' '}
            </div>
          ))}
    </pre>
  );
}

function ResultBanner({ result }: { result: Result }) {
  if (!result) return null;
  const ok = result.exitCode === 0;
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        marginTop: 8,
        background: ok ? 'rgba(117, 212, 155, 0.15)' : 'rgba(255, 118, 118, 0.15)',
        border: `1px solid ${ok ? 'var(--ok)' : 'var(--danger)'}`,
        color: ok ? 'var(--ok)' : 'var(--danger)',
      }}
    >
      {ok ? 'Done.' : `Failed with exit code ${result.exitCode}.`}
    </div>
  );
}

function RebuildSection() {
  const { state, logs, result, start, cancel } = useRunner('/api/rebuild');
  const [artifacts, setArtifacts] = useState<Artifacts | null>(null);

  useEffect(() => {
    fetch('/api/artifacts')
      .then((r) => r.json() as Promise<Artifacts>)
      .then(setArtifacts)
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2>Rebuild firmware</h2>
      <p style={{ color: 'var(--fg-dim)' }}>
        Runs <code>./rebuild</code> — builds left, right, and settings_reset firmware. Takes 3–6 minutes.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={start} disabled={state === 'running'}>
          {state === 'running' ? 'Rebuilding…' : 'Rebuild firmware'}
        </button>
        {state === 'running' && <button onClick={cancel}>Cancel</button>}
      </div>
      <LogView lines={logs} />
      <ResultBanner result={result} />
      {result?.exitCode === 0 && artifacts && (
        <div style={{ marginTop: 12 }}>
          <strong>UF2 files ready to flash:</strong>
          <ul style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            <li><strong>Left:</strong> {artifacts.left}</li>
            <li><strong>Right:</strong> {artifacts.right}</li>
            <li><strong>Settings reset:</strong> {artifacts.settingsReset}</li>
          </ul>
          <p style={{ color: 'var(--fg-dim)', fontSize: 13 }}>
            Double-tap reset on each half to enter bootloader mode, then drag the corresponding UF2 to the
            mounted drive. Settings reset is only needed after big keymap changes or BT pairing issues.
          </p>
        </div>
      )}
    </section>
  );
}

function KleSection() {
  const { state, logs, result, start, cancel } = useRunner('/api/generate-kle');
  const [copied, setCopied] = useState(false);

  const stdoutText = logs
    .filter((l) => l.stream === 'stdout')
    .map((l) => l.line)
    .join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(stdoutText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Generate KLE layout</h2>
      <p style={{ color: 'var(--fg-dim)' }}>
        Runs <code>./generate-kle</code> — parses the keymap and emits a config you can paste into{' '}
        <a href="https://www.keyboard-layout-editor.com" target="_blank" rel="noreferrer">
          keyboard-layout-editor.com
        </a>{' '}
        to visualize your layout. Takes about a second.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={start} disabled={state === 'running'}>
          {state === 'running' ? 'Generating…' : 'Generate KLE'}
        </button>
        {state === 'running' && <button onClick={cancel}>Cancel</button>}
        {result?.exitCode === 0 && stdoutText && (
          <button onClick={copy}>{copied ? 'Copied!' : 'Copy to clipboard'}</button>
        )}
      </div>
      <LogView lines={logs} />
      <ResultBanner result={result} />
      {result?.exitCode === 0 && (
        <p style={{ color: 'var(--fg-dim)', fontSize: 13 }}>
          Paste the copied output into the <strong>Raw data</strong> tab on keyboard-layout-editor.com.
        </p>
      )}
    </section>
  );
}

export function BuildPanel() {
  return (
    <div>
      <h1>Build</h1>
      <RebuildSection />
      <KleSection />
    </div>
  );
}
