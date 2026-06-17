import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { labelFor } from '../keymap/labels';
import { corneLayout, layoutBoundingBox, type KeyRect } from '../keymap/layout';
import type { Binding, Combo, Keymap } from '../types';

const KEY_SIZE = 50; // px per unit

function KeyCell({
  rect,
  binding,
  highlight,
  onHover,
}: {
  rect: KeyRect;
  binding: Binding | undefined;
  highlight?: boolean;
  onHover?: (pos: number | null) => void;
}) {
  const text = binding ? labelFor(binding) : { label: '?' };
  const bg = !binding
    ? 'var(--bg-elev-2)'
    : binding.behavior === '&trans'
      ? 'var(--bg-elev)'
      : binding.behavior === '&none'
        ? 'var(--bg-elev)'
        : 'var(--bg-elev-2)';
  return (
    <g
      transform={`translate(${rect.x * KEY_SIZE}, ${rect.y * KEY_SIZE})`}
      onMouseEnter={() => onHover?.(rect.position)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: 'default' }}
    >
      <rect
        width={rect.width * KEY_SIZE - 4}
        height={rect.height * KEY_SIZE - 4}
        rx={6}
        fill={bg}
        stroke={highlight ? 'var(--accent-2)' : 'var(--border)'}
        strokeWidth={highlight ? 2 : 1}
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

function ComboOverlay({
  combo,
  rects,
}: {
  combo: Combo;
  rects: KeyRect[];
}) {
  const points = combo.keyPositions
    .map((p) => rects.find((r) => r.position === p))
    .filter((r): r is KeyRect => !!r)
    .map((r) => ({
      x: (r.x + r.width / 2) * KEY_SIZE,
      y: (r.y + r.height / 2) * KEY_SIZE,
    }));
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

export function KeymapViewer() {
  const [km, setKm] = useState<Keymap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [hoverPos, setHoverPos] = useState<number | null>(null);
  const [activeCombo, setActiveCombo] = useState<string | null>(null);

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
  const overlayCombo = activeCombo
    ? km.combos.find((c) => c.name === activeCombo)
    : undefined;

  const hoverAllLayers =
    hoverPos !== null
      ? km.layers.map((l) => ({ display: l.displayName, binding: l.bindings[hoverPos] }))
      : [];

  return (
    <div>
      <h1>Keymap</h1>
      <p style={{ color: 'var(--fg-dim)' }}>
        Read-only view of <code>config/corne.keymap</code>. Hover a key to see all four layers.
        Editing comes in Phase 5b.
      </p>

      <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
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
        style={{ maxWidth: 900, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}
      >
        {rects.map((r) => (
          <KeyCell
            key={r.position}
            rect={r}
            binding={layer.bindings[r.position]}
            highlight={r.position === hoverPos}
            onHover={setHoverPos}
          />
        ))}
        {overlayCombo && <ComboOverlay combo={overlayCombo} rects={rects} />}
      </svg>

      <h2 style={{ marginTop: 32 }}>Combos</h2>
      <p style={{ color: 'var(--fg-dim)' }}>
        Press two or more keys together within the timeout to fire a different binding. Hover an entry to see
        which keys it involves.
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
    </div>
  );
}
