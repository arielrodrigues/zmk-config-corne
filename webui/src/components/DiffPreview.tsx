type Props = {
  before: string;
  after: string;
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
  filename?: string;
};

type Row = { kind: 'context' | 'add' | 'remove'; text: string };

function diffLines(before: string, after: string): Row[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const rows: Row[] = [];
  // Simple two-pointer with context; sufficient because our edits are localized.
  // Compute LCS length matrix to produce a minimal-ish edit script.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'context', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'remove', text: a[i] });
      i++;
    } else {
      rows.push({ kind: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ kind: 'remove', text: a[i++] });
  while (j < m) rows.push({ kind: 'add', text: b[j++] });
  return rows;
}

function trimContext(rows: Row[], contextLines = 3): Row[] {
  // Keep only N lines of context around add/remove rows.
  const keep = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== 'context') {
      for (let k = Math.max(0, i - contextLines); k <= Math.min(rows.length - 1, i + contextLines); k++) {
        keep.add(k);
      }
    }
  }
  const result: Row[] = [];
  let lastKept = -2;
  for (let i = 0; i < rows.length; i++) {
    if (!keep.has(i)) continue;
    if (lastKept !== -1 && i - lastKept > 1) {
      result.push({ kind: 'context', text: '…' });
    }
    result.push(rows[i]);
    lastKept = i;
  }
  return result;
}

export function DiffPreview({ before, after, onConfirm, onCancel, saving, filename }: Props) {
  const unchanged = before === after;
  const rows = unchanged ? [] : trimContext(diffLines(before, after));
  const addCount = rows.filter((r) => r.kind === 'add').length;
  const remCount = rows.filter((r) => r.kind === 'remove').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 11, 17, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 'min(720px, 100%)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>{filename ?? 'Changes preview'}</strong>{' '}
            <span style={{ color: 'var(--fg-dim)', fontSize: 12, marginLeft: 8 }}>
              {unchanged ? 'no changes' : `+${addCount} −${remCount}`}
            </span>
          </div>
        </header>
        <pre
          style={{
            margin: 0,
            padding: 12,
            overflow: 'auto',
            fontSize: 12,
            flex: 1,
            background: '#0c0f17',
            borderRadius: 0,
            border: 0,
          }}
        >
          {unchanged ? (
            <span style={{ color: 'var(--fg-dim)' }}>No changes — saving will be a no-op.</span>
          ) : (
            rows.map((r, idx) => {
              const bg =
                r.kind === 'add'
                  ? 'rgba(117, 212, 155, 0.15)'
                  : r.kind === 'remove'
                    ? 'rgba(255, 118, 118, 0.15)'
                    : 'transparent';
              const fg =
                r.kind === 'add'
                  ? 'var(--ok)'
                  : r.kind === 'remove'
                    ? 'var(--danger)'
                    : 'var(--fg-dim)';
              const prefix = r.kind === 'add' ? '+ ' : r.kind === 'remove' ? '- ' : '  ';
              return (
                <div key={idx} style={{ background: bg, color: fg, padding: '0 6px' }}>
                  {prefix}
                  {r.text || ' '}
                </div>
              );
            })
          )}
        </pre>
        <footer
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={saving || unchanged}>
            {saving ? 'Saving…' : 'Confirm & save'}
          </button>
        </footer>
      </div>
    </div>
  );
}
