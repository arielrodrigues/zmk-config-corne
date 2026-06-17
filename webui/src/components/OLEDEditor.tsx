import { useEffect, useState } from 'react';
import { api } from '../api';
import { HELP } from '../help';
import type { OLEDConstants } from '../types';
import { DiffPreview } from './DiffPreview';
import { InfoTooltip } from './InfoTooltip';

function shallowEqual(a: OLEDConstants, b: OLEDConstants): boolean {
  return (
    a.loveTimeoutMs === b.loveTimeoutMs &&
    a.fastWpm === b.fastWpm &&
    a.loveText === b.loveText &&
    a.vampireFrames.idle === b.vampireFrames.idle &&
    a.vampireFrames.left === b.vampireFrames.left &&
    a.vampireFrames.right === b.vampireFrames.right &&
    a.vampireFrames.fast === b.vampireFrames.fast
  );
}

function Field({
  label,
  helpKey,
  children,
}: {
  label: string;
  helpKey?: string;
  children: React.ReactNode;
}) {
  const help = helpKey ? HELP[helpKey] : undefined;
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'flex', alignItems: 'center', fontWeight: 500, marginBottom: 6 }}>
        <span>{label}</span>
        <InfoTooltip entry={help} />
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elev-2)',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '6px 10px',
  font: 'inherit',
};

export function OLEDEditor() {
  const [original, setOriginal] = useState<OLEDConstants | null>(null);
  const [draft, setDraft] = useState<OLEDConstants | null>(null);
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
        <h1>OLED Display</h1>
        <div style={{ color: 'var(--danger)' }}>Failed to load: {loadError}</div>
      </div>
    );
  }
  if (!draft || !original) {
    return (
      <div>
        <h1>OLED Display</h1>
        <div className="placeholder">Loading…</div>
      </div>
    );
  }

  const dirty = !shallowEqual(original, draft);

  const update = (patch: Partial<OLEDConstants>) => setDraft({ ...draft, ...patch });

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
      <h1>OLED Display</h1>
      <p style={{ color: 'var(--fg-dim)' }}>
        Edits these settings live in <code>config/custom_status_screen.c</code> on the left half.
        Apply them by rebuilding and flashing the left UF2.
      </p>

      <Field label="Idle love message" helpKey="oled.loveText">
        <textarea
          value={draft.loveText}
          onChange={(e) => update({ loveText: e.target.value })}
          rows={3}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'ui-monospace, monospace' }}
        />
        <div style={{ marginTop: 6, color: 'var(--fg-dim)', fontSize: 12 }}>
          Preview (any monospace font; the actual OLED uses Montserrat 14):
        </div>
        <div
          style={{
            marginTop: 4,
            padding: 16,
            background: '#000',
            color: '#fff',
            borderRadius: 4,
            fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
            minHeight: 60,
            border: '1px solid var(--border)',
          }}
        >
          {draft.loveText}
        </div>
      </Field>

      <Field label="Idle timeout" helpKey="oled.loveTimeoutMs">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            min={0}
            max={600}
            step={1}
            value={Math.round(draft.loveTimeoutMs / 1000)}
            onChange={(e) => {
              const sec = Number(e.target.value);
              if (Number.isFinite(sec)) update({ loveTimeoutMs: Math.max(0, sec) * 1000 });
            }}
            style={{ ...inputStyle, width: 120 }}
          />
          <span style={{ color: 'var(--fg-dim)' }}>seconds</span>
          <span style={{ color: 'var(--fg-dim)', fontSize: 12, marginLeft: 12 }}>
            ({draft.loveTimeoutMs} ms in the source)
          </span>
        </div>
      </Field>

      <Field label="Fast vampire WPM threshold" helpKey="oled.fastWpm">
        <input
          type="number"
          min={0}
          max={500}
          step={1}
          value={draft.fastWpm}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) update({ fastWpm: Math.max(0, n) });
          }}
          style={{ ...inputStyle, width: 120 }}
        />
      </Field>

      <div style={{ marginTop: 24, padding: 12, background: 'var(--bg-elev)', borderRadius: 6, borderLeft: '3px solid var(--accent)' }}>
        <strong>Editing the vampire frames?</strong>
        <p style={{ margin: '6px 0 0', color: 'var(--fg-dim)' }}>
          The four animation frames live in the same file. They get their own editor in Phase 4.
        </p>
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
          Discard changes
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
