import { useEffect, useState } from 'react';
import { api } from '../api';
import { HELP } from '../help';
import type { RGBConfig } from '../types';
import { DiffPreview } from './DiffPreview';
import { InfoTooltip } from './InfoTooltip';

const EFFECTS = ['Solid', 'Breathe', 'Spectrum', 'Swirl'] as const;

function hsvToHex(h: number, s: number, v: number): string {
  const C = (v / 100) * (s / 100);
  const Hp = h / 60;
  const X = C * (1 - Math.abs((Hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (Hp < 1) [r, g, b] = [C, X, 0];
  else if (Hp < 2) [r, g, b] = [X, C, 0];
  else if (Hp < 3) [r, g, b] = [0, C, X];
  else if (Hp < 4) [r, g, b] = [0, X, C];
  else if (Hp < 5) [r, g, b] = [X, 0, C];
  else [r, g, b] = [C, 0, X];
  const m = v / 100 - C;
  const toHex = (x: number) =>
    Math.round((x + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function shallowEqualRGB(a: RGBConfig, b: RGBConfig): boolean {
  return (
    a.enabled === b.enabled &&
    a.onStart === b.onStart &&
    a.extPower === b.extPower &&
    a.effect === b.effect &&
    a.hue === b.hue &&
    a.saturation === b.saturation &&
    a.brightness === b.brightness &&
    a.speed === b.speed &&
    a.brightnessStep === b.brightnessStep
  );
}

type FieldProps = {
  label: string;
  helpKey?: string;
  children: React.ReactNode;
};

function Field({ label, helpKey, children }: FieldProps) {
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

function Slider({
  value,
  min,
  max,
  onChange,
  disabled,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        style={{
          width: 70,
          padding: '4px 6px',
          background: 'var(--bg-elev-2)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
        }}
      />
      {suffix && <span style={{ color: 'var(--fg-dim)', minWidth: 24 }}>{suffix}</span>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function RGBEditor() {
  const [original, setOriginal] = useState<RGBConfig | null>(null);
  const [draft, setDraft] = useState<RGBConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getConfig()
      .then((c) => {
        setOriginal(c.rgb);
        setDraft(c.rgb);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  if (loadError) {
    return (
      <div>
        <h1>RGB Underglow</h1>
        <div style={{ color: 'var(--danger)' }}>Failed to load: {loadError}</div>
      </div>
    );
  }
  if (!draft || !original) {
    return (
      <div>
        <h1>RGB Underglow</h1>
        <div className="placeholder">Loading…</div>
      </div>
    );
  }

  const dirty = !shallowEqualRGB(original, draft);
  const swatch = hsvToHex(draft.hue, draft.saturation, draft.brightness);
  const isSolid = draft.effect === 0;

  const update = (patch: Partial<RGBConfig>) => setDraft({ ...draft, ...patch });

  const onSave = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const d = await api.previewConfig(draft);
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
      const updated = await api.saveConfig(draft);
      setOriginal(updated.rgb);
      setDraft(updated.rgb);
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
      <h1>RGB Underglow</h1>
      <p style={{ color: 'var(--fg-dim)' }}>
        Edits these settings live in <code>config/corne.conf</code>. Apply them by rebuilding and
        flashing both halves.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 200px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        <div>
          <Field label="Effect" helpKey="rgb.effect">
            <select
              value={draft.effect}
              onChange={(e) => update({ effect: Number(e.target.value) })}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'var(--bg-elev-2)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              {EFFECTS.map((name, idx) => (
                <option key={idx} value={idx}>
                  {idx} — {name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hue" helpKey="rgb.hue">
            <Slider
              value={draft.hue}
              min={0}
              max={359}
              onChange={(n) => update({ hue: n })}
              suffix="°"
            />
          </Field>

          <Field label="Saturation" helpKey="rgb.saturation">
            <Slider
              value={draft.saturation}
              min={0}
              max={100}
              onChange={(n) => update({ saturation: n })}
              suffix="%"
            />
          </Field>

          <Field label="Brightness" helpKey="rgb.brightness">
            <Slider
              value={draft.brightness}
              min={0}
              max={100}
              onChange={(n) => update({ brightness: n })}
              suffix="%"
            />
          </Field>

          <Field label="Animation speed" helpKey="rgb.speed">
            <Slider
              value={draft.speed}
              min={1}
              max={5}
              onChange={(n) => update({ speed: n })}
              disabled={isSolid}
            />
            {isSolid && (
              <div style={{ color: 'var(--fg-dim)', fontSize: 12, marginTop: 4 }}>
                (Solid effect has no animation.)
              </div>
            )}
          </Field>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            <Toggle
              checked={draft.enabled}
              onChange={(b) => update({ enabled: b })}
              label="LED driver enabled"
            />
            <Toggle
              checked={draft.onStart}
              onChange={(b) => update({ onStart: b })}
              label="Start LEDs on at boot"
            />
            <Toggle
              checked={draft.extPower}
              onChange={(b) => update({ extPower: b })}
              label="Allow LED toggle to cut peripheral power (kills OLED)"
            />
          </div>

          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--fg-dim)' }}>Advanced</summary>
            <Field label="Brightness step" helpKey="rgb.brightnessStep">
              <Slider
                value={draft.brightnessStep ?? 10}
                min={1}
                max={50}
                onChange={(n) => update({ brightnessStep: n })}
              />
            </Field>
          </details>
        </div>

        <div style={{ position: 'sticky', top: 0 }}>
          <div style={{ marginBottom: 8, color: 'var(--fg-dim)', fontSize: 12 }}>Color preview</div>
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 12,
              background: swatch,
              border: '1px solid var(--border)',
              boxShadow: `0 0 24px ${swatch}40`,
            }}
            aria-label={`Swatch: ${swatch}`}
          />
          <div
            style={{
              marginTop: 6,
              fontFamily: 'ui-monospace, monospace',
              color: 'var(--fg-dim)',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            {swatch.toUpperCase()}
          </div>
        </div>
      </div>

      {previewError && (
        <div style={{ marginTop: 12, color: 'var(--danger)' }}>{previewError}</div>
      )}
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
          filename="config/corne.conf"
        />
      )}
    </div>
  );
}
