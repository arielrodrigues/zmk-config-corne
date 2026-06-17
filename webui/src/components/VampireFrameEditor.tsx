import { useEffect, useState } from 'react';
import { api } from '../api';
import type { OLEDConstants } from '../types';
import { DiffPreview } from './DiffPreview';

type FrameName = 'idle' | 'left' | 'right' | 'fast';

const FRAME_TABS: { key: FrameName; label: string; hint: string }[] = [
  { key: 'idle', label: 'Idle (0 WPM)', hint: 'When you stop typing.' },
  { key: 'left', label: 'Cape — left', hint: '1–threshold WPM, alternating with right.' },
  { key: 'right', label: 'Cape — right', hint: '1–threshold WPM, alternating with left.' },
  { key: 'fast', label: 'Fast (above threshold)', hint: 'When you exceed the WPM threshold.' },
];

const COLS = 7;
const ROWS = 4;

function framesEqual(a: OLEDConstants['vampireFrames'], b: OLEDConstants['vampireFrames']): boolean {
  return a.idle === b.idle && a.left === b.left && a.right === b.right && a.fast === b.fast;
}

function constantsEqual(a: OLEDConstants, b: OLEDConstants): boolean {
  return (
    a.loveTimeoutMs === b.loveTimeoutMs &&
    a.fastWpm === b.fastWpm &&
    a.loveText === b.loveText &&
    framesEqual(a.vampireFrames, b.vampireFrames)
  );
}

function frameLines(frame: string): string[] {
  return frame.split('\n');
}

function widthWarnings(frame: string): string[] {
  const out: string[] = [];
  const lines = frameLines(frame);
  if (lines.length !== ROWS) {
    out.push(`Expected ${ROWS} lines, found ${lines.length}.`);
  }
  lines.forEach((line, idx) => {
    if (line.length > COLS) {
      out.push(`Line ${idx + 1} is ${line.length} chars wide (max ${COLS}); will clip on the OLED.`);
    }
  });
  return out;
}

export function VampireFrameEditor() {
  const [original, setOriginal] = useState<OLEDConstants | null>(null);
  const [draft, setDraft] = useState<OLEDConstants | null>(null);
  const [activeTab, setActiveTab] = useState<FrameName>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getOLED()
      .then((p) => {
        const next: OLEDConstants = {
          loveTimeoutMs: p.loveTimeoutMs,
          fastWpm: p.fastWpm,
          loveText: p.loveText,
          vampireFrames: p.vampireFrames,
        };
        setOriginal(next);
        setDraft(next);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  if (loadError) {
    return (
      <div>
        <h1>Vampire Frames</h1>
        <div style={{ color: 'var(--danger)' }}>Failed to load: {loadError}</div>
      </div>
    );
  }
  if (!draft || !original) {
    return (
      <div>
        <h1>Vampire Frames</h1>
        <div className="placeholder">Loading…</div>
      </div>
    );
  }

  const dirty = !constantsEqual(original, draft);
  const currentFrame = draft.vampireFrames[activeTab];
  const warnings = widthWarnings(currentFrame);

  const updateFrame = (name: FrameName, value: string) => {
    setDraft({
      ...draft,
      vampireFrames: { ...draft.vampireFrames, [name]: value },
    });
  };

  const resetFrame = (name: FrameName) => {
    setDraft({
      ...draft,
      vampireFrames: { ...draft.vampireFrames, [name]: original.vampireFrames[name] },
    });
  };

  const onSave = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const d = await api.previewOLED(draft);
      setDiff(d);
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  const onConfirm = async () => {
    setSaving(true);
    try {
      const updated = await api.saveOLED(draft);
      const fresh: OLEDConstants = {
        loveTimeoutMs: updated.loveTimeoutMs,
        fastWpm: updated.fastWpm,
        loveText: updated.loveText,
        vampireFrames: updated.vampireFrames,
      };
      setOriginal(fresh);
      setDraft(fresh);
      setDiff(null);
      setSavedMsg('Saved. Run a Rebuild to apply.');
      setTimeout(() => setSavedMsg(null), 4000);
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1>Vampire Frames</h1>
      <p style={{ color: 'var(--fg-dim)' }}>
        Each frame is <strong>{ROWS} lines × {COLS} characters</strong> of monospace ASCII art shown on the
        right side of the left-half OLED. The keyboard picks which frame to show based on your typing speed.
      </p>

      <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {FRAME_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === activeTab}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: t.key === activeTab ? 'var(--bg-elev-2)' : 'transparent',
              border: 0,
              borderBottom: t.key === activeTab ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: '4px 4px 0 0',
              padding: '8px 14px',
              color: t.key === activeTab ? 'var(--fg)' : 'var(--fg-dim)',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p style={{ color: 'var(--fg-dim)', fontSize: 13, marginTop: 0 }}>
        {FRAME_TABS.find((t) => t.key === activeTab)?.hint}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 32, alignItems: 'start' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
            Frame source
          </label>
          <textarea
            value={currentFrame}
            onChange={(e) => updateFrame(activeTab, e.target.value)}
            rows={ROWS + 2}
            spellCheck={false}
            wrap="off"
            style={{
              width: '100%',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 14,
              background: 'var(--bg-elev-2)',
              color: 'var(--fg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '10px 12px',
              tabSize: 1,
              lineHeight: '1.4',
            }}
          />
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => resetFrame(activeTab)}
              disabled={currentFrame === original.vampireFrames[activeTab]}
              style={{ background: 'transparent' }}
            >
              Reset this frame
            </button>
            <span style={{ color: 'var(--fg-dim)', fontSize: 12 }}>
              {frameLines(currentFrame).length} lines
            </span>
          </div>

          {warnings.length > 0 && (
            <ul style={{ marginTop: 12, color: 'var(--accent-2)', fontSize: 13 }}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div style={{ marginBottom: 8, color: 'var(--fg-dim)', fontSize: 12 }}>OLED preview</div>
          <div
            style={{
              background: '#000',
              color: '#fff',
              padding: 16,
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 18,
              lineHeight: '1.1',
              whiteSpace: 'pre',
              minHeight: ROWS * 22,
            }}
          >
            {currentFrame || ' '}
          </div>
          <div style={{ marginTop: 8, color: 'var(--fg-dim)', fontSize: 12 }}>
            Approximate scale — the actual OLED uses the UNSCII 8 font and is 128×32 pixels.
          </div>
        </div>
      </div>

      {previewError && <div style={{ marginTop: 12, color: 'var(--danger)' }}>{previewError}</div>}
      {savedMsg && <div style={{ marginTop: 12, color: 'var(--ok)' }}>{savedMsg}</div>}

      <div style={{ marginTop: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onSave} disabled={!dirty || previewing}>
          {previewing ? 'Computing diff…' : 'Save…'}
        </button>
        <button
          onClick={() => setDraft(original)}
          disabled={!dirty}
          style={{ background: 'transparent' }}
        >
          Discard all changes
        </button>
        {dirty && <span style={{ color: 'var(--accent-2)', fontSize: 12 }}>● Unsaved</span>}
      </div>

      {diff && (
        <DiffPreview
          before={diff.before}
          after={diff.after}
          onConfirm={onConfirm}
          onCancel={() => setDiff(null)}
          saving={saving}
          filename="config/custom_status_screen.c"
        />
      )}
    </div>
  );
}
