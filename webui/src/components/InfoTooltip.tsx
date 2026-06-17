import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { HelpEntry } from '../help';

export function InfoTooltip({ entry }: { entry: HelpEntry | undefined }) {
  const [open, setOpen] = useState(false);
  if (!entry) return null;

  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More info"
        style={{
          width: 18,
          height: 18,
          padding: 0,
          fontSize: 11,
          borderRadius: '50%',
          background: 'var(--bg-elev-2)',
          color: 'var(--fg-dim)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
        }}
      >
        ?
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            zIndex: 10,
            width: 320,
            padding: '10px 12px',
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
            fontSize: 12,
            color: 'var(--fg)',
            lineHeight: 1.4,
            fontWeight: 'normal',
          }}
        >
          <div>{entry.short}</div>
          {entry.long && (
            <div style={{ marginTop: 8, color: 'var(--fg-dim)' }}>{entry.long}</div>
          )}
          {entry.learnMoreSlug && (
            <div style={{ marginTop: 8 }}>
              <Link to={`/docs/${entry.learnMoreSlug}`}>Learn more →</Link>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
