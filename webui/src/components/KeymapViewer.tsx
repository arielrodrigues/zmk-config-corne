import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { labelFor } from '../keymap/labels';
import { corneLayout, layoutBoundingBox, type KeyRect } from '../keymap/layout';
import type { Binding, Combo, Keymap, KeymapEdit } from '../types';
import { BindingPicker } from './BindingPicker';
import { DiffPreview } from './DiffPreview';

const KEY_SIZE = 50;

function KeyCell({
  rect,
  binding,
  highlight,
  edited,
  onHover,
  onClick,
}: {
  rect: KeyRect;
  binding: Binding | undefined;
  highlight?: boolean;
  edited?: boolean;
  onHover?: (pos: number | null) => void;
  onClick?: (pos: number) => void;
}) {
  const text = binding ? labelFor(binding) : { label: '?' };
  const bg = edited
    ? 'rgba(106, 167, 255, 0.25)'
    : !binding
      ? 'var(--bg-elev-2)'
      : binding.behavior === '&trans' || binding.behavior === '&none'
        ? 'var(--bg-elev)'
        : 'var(--bg-elev-2)';
  return (
    <g
      transform={`translate(${rect.x * KEY_SIZE}, ${rect.y * KEY_SIZE})`}
      onMouseEnter={() => onHover?.(rect.position)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(rect.position)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <rect
        width={rect.width * KEY_SIZE - 4}
        height={rect.height * KEY_SIZE - 4}
        rx={6}
        fill={bg}
        stroke={highlight ? 'var(--accent-2)' : edited ? 'var(--accent)' : 'var(--border)'}
        strokeWidth={highlight || edited ? 2 : 1}
      />
      <text
        x={(rect.width * KEY_SIZE - 4) / 2}
        y={(rect.height * KEY_SIZE - 4) / 2 + (text.sub ? -2 : 4)}
        textAnchor="middle"
        fontSize={text.label.length > 5 ? 9 : 11}
        fill={
          binding?.behavior === '&trans' || binding?.behavior === '&none'
            ? 'var(--fg-dim)'
            : 'var(--fg)'
        }
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {text.label}
      </text>
      {text.sub && (
        <text
          x={(rect.width * KEY_SIZE - 4) / 2}
          y={(rect.height * KEY_SIZE - 4) / 2 + 12}
          textAnchor="middle"
          fontSize={9}
          fill="var(--fg-dim)"
        >
          {text.sub}
        </text>
      )}
      <text
        x={4}
        y={11}
        fontSize={8}
        fill="var(--fg-dim)"
        opacity={0.5}
        fontFamily="ui-monospace, monospace"
      >
        {rect.position}
      </text>
    </g>
  );
}

function ComboOverlay({ combo, rects }: { combo: Combo; rects: KeyRect[] }) {
  const points = combo.keyPositions
    .map((p) => rects.find((r) => r.position === p))
    .filter((r): r is KeyRect => !!r)
    .map((r) => ({ x: (r.x + r.width / 2) * KEY_SIZE, y: (r.y + r.height / 2) * KEY_SIZE }));
  if (points.length < 2) return null;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return (
    <g>
      {points.map((p, i) => (
        <line
          key={i}
          x1={p.x}
          y1={p.y}
          x2={cx}
          y2={cy}
          stroke="var(--accent-2)"
          strokeWidth={2}
          strokeDasharray="4 4"
          opacity={0.8}
        />
      ))}
      <circle cx={cx} cy={cy} r={14} fill="var(--accent-2)" stroke="var(--bg)" strokeWidth={2} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="#0b1220">
        {labelFor(combo.bindings[0] ?? { behavior: '', args: [], raw: '' }).label.slice(0, 4)}
      </text>
    </g>
  );
}

type EditKey = string; // `${layerName}:${position}`
const editKey = (layerName: string, position: number): EditKey => `${layerName}:${position}`;

export function KeymapViewer() {
  const [km, setKm] = useState<Keymap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [hoverPos, setHoverPos] = useState<number | null>(null);
  const [activeCombo, setActiveCombo] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<EditKey, KeymapEdit>>(new Map());
  const [picker, setPicker] = useState<{ position: number; current: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getKeymap()
      .then(setKm)
      .catch((e: Error) => setError(e.message));
  }, []);

  const rects = useMemo(() => corneLayout(), []);
  const bbox = useMemo(() => layoutBoundingBox(rects), [rects]);

  if (error) {
    return (
      <div>
        <h1>Keymap</h1>
        <div style={{ color: 'var(--danger)' }}>Failed to load: {error}</div>
      </div>
    );
  }
  if (!km) {
    return (
      <div>
        <h1>Keymap</h1>
        <div className="placeholder">Loading…</div>
      </div>
    );
  }

  const layer = km.layers[activeLayer];
  const overlayCombo = activeCombo ? km.combos.find((c) => c.name === activeCombo) : undefined;

  const effectiveBinding = (layerIdx: number, position: number): Binding | undefined => {
    const baseLayer = km.layers[layerIdx];
    const original = baseLayer.bindings[position];
    const pending = pendingEdits.get(editKey(baseLayer.name, position));
    if (pending) {
      // Synthesize a Binding from the raw text for display.
      const tokens = pending.newBinding.trim().split(/\s+/);
      return {
        behavior: tokens[0],
        args: tokens.slice(1),
        raw: pending.newBinding.trim(),
      };
    }
    return original;
  };

  const isEdited = (layerIdx: number, position: number): boolean =>
    pendingEdits.has(editKey(km.layers[layerIdx].name, position));

  const hoverAllLayers =
    hoverPos !== null
      ? km.layers.map((l, i) => ({
          display: l.displayName,
          binding: effectiveBinding(i, hoverPos),
        }))
      : [];

  const onKeyClick = (position: number) => {
    if (!editMode) return;
    const b = effectiveBinding(activeLayer, position);
    setPicker({ position, current: b?.raw ?? '&none' });
  };

  const applyPick = (binding: string) => {
    if (!picker) return;
    const next = new Map(pendingEdits);
    const k = editKey(layer.name, picker.position);
    const originalRaw = layer.bindings[picker.position]?.raw ?? '';
    if (binding.trim() === originalRaw.trim()) {
      next.delete(k);
    } else {
      next.set(k, { layer: layer.name, position: picker.position, newBinding: binding });
    }
    setPendingEdits(next);
    setPicker(null);
  };

  const dirty = pendingEdits.size > 0;

  const onSave = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const d = await api.previewKeymap([...pendingEdits.values()]);
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
      const updated = await api.saveKeymap([...pendingEdits.values()]);
      setKm(updated);
      setPendingEdits(new Map());
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 style={{ marginRight: 'auto' }}>Keymap</h1>
        <button
          onClick={() => {
            setEditMode((m) => !m);
            setPicker(null);
          }}
          style={{
            background: editMode ? 'var(--accent)' : 'var(--bg-elev-2)',
            color: editMode ? '#0b1220' : 'var(--fg)',
          }}
        >
          {editMode ? 'Editing — click a key' : 'Edit mode'}
        </button>
      </div>
      <p style={{ color: 'var(--fg-dim)' }}>
        Hover a key to see all four layers. Toggle <strong>Edit mode</strong> to remap.
        Edits accumulate locally — review the diff before saving.
      </p>

      <div
        role="tablist"
        style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border)' }}
      >
        {km.layers.map((l, i) => (
          <button
            key={l.name}
            role="tab"
            aria-selected={i === activeLayer}
            onClick={() => setActiveLayer(i)}
            style={{
              background: i === activeLayer ? 'var(--bg-elev-2)' : 'transparent',
              border: 0,
              borderBottom: i === activeLayer ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: '4px 4px 0 0',
              padding: '8px 14px',
              color: i === activeLayer ? 'var(--fg)' : 'var(--fg-dim)',
              cursor: 'pointer',
            }}
          >
            {l.displayName}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${bbox.width * KEY_SIZE + 8} ${bbox.height * KEY_SIZE + 8}`}
        width="100%"
        style={{
          maxWidth: 900,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 4,
        }}
      >
        {rects.map((r) => (
          <KeyCell
            key={r.position}
            rect={r}
            binding={effectiveBinding(activeLayer, r.position)}
            highlight={r.position === hoverPos}
            edited={isEdited(activeLayer, r.position)}
            onHover={setHoverPos}
            onClick={editMode ? onKeyClick : undefined}
          />
        ))}
        {overlayCombo && <ComboOverlay combo={overlayCombo} rects={rects} />}
      </svg>

      {(dirty || previewError || savedMsg) && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onSave} disabled={!dirty || previewing}>
            {previewing ? 'Computing diff…' : `Save ${pendingEdits.size} edit${pendingEdits.size === 1 ? '' : 's'}…`}
          </button>
          <button
            onClick={() => setPendingEdits(new Map())}
            disabled={!dirty}
            style={{ background: 'transparent' }}
          >
            Discard edits
          </button>
          {previewError && <span style={{ color: 'var(--danger)' }}>{previewError}</span>}
          {savedMsg && <span style={{ color: 'var(--ok)' }}>{savedMsg}</span>}
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Combos</h2>
      <p style={{ color: 'var(--fg-dim)' }}>
        Press two or more keys together within the timeout to fire a different binding. Hover an
        entry to see which keys it involves.
      </p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {km.combos.map((c) => {
          const lbl = labelFor(c.bindings[0] ?? { behavior: '', args: [], raw: '' });
          return (
            <li
              key={c.name}
              onMouseEnter={() => setActiveCombo(c.name)}
              onMouseLeave={() => setActiveCombo(null)}
              style={{
                padding: '8px 12px',
                marginBottom: 6,
                background: activeCombo === c.name ? 'var(--bg-elev-2)' : 'var(--bg-elev)',
                borderLeft: `3px solid ${activeCombo === c.name ? 'var(--accent-2)' : 'var(--border)'}`,
                borderRadius: 4,
              }}
            >
              <strong>{c.name}</strong>
              <span style={{ color: 'var(--fg-dim)', marginLeft: 12 }}>
                positions {c.keyPositions.join(' + ')} → <strong>{lbl.label}</strong>
                {c.timeoutMs > 0 && ` (within ${c.timeoutMs}ms)`}
                {c.layers && c.layers.length > 0 && ` · layer-restricted`}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 style={{ marginTop: 32 }}>Per-key layer mapping</h2>
      <p style={{ color: 'var(--fg-dim)' }}>Hover a key above to populate this.</p>
      {hoverPos !== null ? (
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 12px' }}>Position</th>
              {hoverAllLayers.map((l) => (
                <th key={l.display} style={{ textAlign: 'left', padding: '6px 12px' }}>
                  {l.display}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '6px 12px', fontFamily: 'ui-monospace, monospace' }}>{hoverPos}</td>
              {hoverAllLayers.map((l, i) => (
                <td key={i} style={{ padding: '6px 12px', fontFamily: 'ui-monospace, monospace' }}>
                  {l.binding ? l.binding.raw : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--fg-dim)', fontStyle: 'italic' }}>(nothing hovered)</div>
      )}

      {picker && (
        <BindingPicker
          current={picker.current}
          position={picker.position}
          layerName={layer.displayName}
          onPick={applyPick}
          onCancel={() => setPicker(null)}
        />
      )}
      {diff && (
        <DiffPreview
          before={diff.before}
          after={diff.after}
          onConfirm={onConfirm}
          onCancel={() => setDiff(null)}
          saving={saving}
          filename="config/corne.keymap"
        />
      )}
    </div>
  );
}
