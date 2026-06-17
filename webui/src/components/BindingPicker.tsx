import { useState } from 'react';

type Group = { name: string; items: { value: string; label: string }[] };

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => ({
  value: `&kp ${c}`,
  label: c,
}));
const NUMBERS = Array.from({ length: 10 }, (_, i) => ({ value: `&kp N${i}`, label: String(i) }));
const FN_KEYS = Array.from({ length: 12 }, (_, i) => ({
  value: `&kp F${i + 1}`,
  label: `F${i + 1}`,
}));
const MODIFIERS = [
  { value: '&kp LSHFT', label: 'Shift' },
  { value: '&kp LCTRL', label: 'Ctrl' },
  { value: '&kp LALT', label: 'Alt' },
  { value: '&kp LGUI', label: 'Super' },
  { value: '&kp RSHFT', label: 'R-Shift' },
  { value: '&kp RCTRL', label: 'R-Ctrl' },
  { value: '&kp RALT', label: 'R-Alt' },
  { value: '&kp RGUI', label: 'R-Super' },
];
const NAV = [
  { value: '&kp LEFT', label: '←' },
  { value: '&kp DOWN', label: '↓' },
  { value: '&kp UP', label: '↑' },
  { value: '&kp RIGHT', label: '→' },
  { value: '&kp HOME', label: 'Home' },
  { value: '&kp END', label: 'End' },
  { value: '&kp PG_UP', label: 'PgUp' },
  { value: '&kp PG_DN', label: 'PgDn' },
];
const WHITESPACE = [
  { value: '&kp SPACE', label: 'Space' },
  { value: '&kp ENTER', label: 'Enter' },
  { value: '&kp TAB', label: 'Tab' },
  { value: '&kp ESC', label: 'Esc' },
  { value: '&kp BSPC', label: 'Bksp' },
  { value: '&kp DEL', label: 'Del' },
];
const SYMBOLS = [
  { value: '&kp EXCL', label: '!' },
  { value: '&kp AT', label: '@' },
  { value: '&kp HASH', label: '#' },
  { value: '&kp DLLR', label: '$' },
  { value: '&kp PRCNT', label: '%' },
  { value: '&kp CARET', label: '^' },
  { value: '&kp AMPS', label: '&' },
  { value: '&kp ASTRK', label: '*' },
  { value: '&kp LPAR', label: '(' },
  { value: '&kp RPAR', label: ')' },
  { value: '&kp MINUS', label: '-' },
  { value: '&kp UNDER', label: '_' },
  { value: '&kp PLUS', label: '+' },
  { value: '&kp EQUAL', label: '=' },
  { value: '&kp LBKT', label: '[' },
  { value: '&kp RBKT', label: ']' },
  { value: '&kp LBRC', label: '{' },
  { value: '&kp RBRC', label: '}' },
  { value: '&kp PIPE', label: '|' },
  { value: '&kp BSLH', label: '\\' },
  { value: '&kp GRAVE', label: '`' },
  { value: '&kp TILDE', label: '~' },
  { value: '&kp SQT', label: "'" },
  { value: '&kp DQT', label: '"' },
  { value: '&kp SEMI', label: ';' },
  { value: '&kp COMMA', label: ',' },
  { value: '&kp DOT', label: '.' },
  { value: '&kp FSLH', label: '/' },
];
const MEDIA = [
  { value: '&kp C_PLAY_PAUSE', label: '⏯ Play/Pause' },
  { value: '&kp C_NEXT', label: '⏭ Next' },
  { value: '&kp C_PREVIOUS', label: '⏮ Prev' },
  { value: '&kp K_MUTE', label: '🔇 Mute' },
  { value: '&kp C_VOL_UP', label: '🔊 Vol+' },
  { value: '&kp C_VOL_DN', label: '🔉 Vol−' },
];
const LAYERS = [
  { value: '&mo NAV_L', label: 'MO Nav' },
  { value: '&mo SYM_L', label: 'MO Sym' },
  { value: '&mo ADJ_L', label: 'MO Adj' },
];
const BLUETOOTH = [
  { value: '&bt BT_SEL 0', label: 'BT 0' },
  { value: '&bt BT_SEL 1', label: 'BT 1' },
  { value: '&bt BT_SEL 2', label: 'BT 2' },
  { value: '&bt BT_SEL 3', label: 'BT 3' },
  { value: '&bt BT_SEL 4', label: 'BT 4' },
  { value: '&bt BT_CLR', label: 'BT Clear' },
  { value: '&bt BT_CLR_ALL', label: 'BT Clear all' },
  { value: '&bt BT_NXT', label: 'BT next' },
  { value: '&bt BT_PRV', label: 'BT prev' },
];
const RGB = [
  { value: '&rgb_ug RGB_TOG', label: 'RGB Toggle' },
  { value: '&rgb_ug RGB_EFF', label: 'Effect +' },
  { value: '&rgb_ug RGB_EFR', label: 'Effect −' },
  { value: '&rgb_ug RGB_BRI', label: 'Brightness +' },
  { value: '&rgb_ug RGB_BRD', label: 'Brightness −' },
  { value: '&rgb_ug RGB_HUI', label: 'Hue +' },
  { value: '&rgb_ug RGB_HUD', label: 'Hue −' },
  { value: '&rgb_ug RGB_SAI', label: 'Saturation +' },
  { value: '&rgb_ug RGB_SAD', label: 'Saturation −' },
];
const POWER = [
  { value: '&ext_power EP_ON', label: 'Power on' },
  { value: '&ext_power EP_OFF', label: 'Power off' },
  { value: '&out OUT_USB', label: 'Output → USB' },
  { value: '&out OUT_BLE', label: 'Output → BLE' },
  { value: '&sys_reset', label: 'System reset' },
  { value: '&bootloader', label: 'Bootloader' },
  { value: '&studio_unlock', label: 'Studio unlock' },
];
const SPECIAL = [
  { value: '&trans', label: '▽ Transparent' },
  { value: '&none', label: '· None' },
];

const GROUPS: Group[] = [
  { name: 'Special', items: SPECIAL },
  { name: 'Letters', items: LETTERS },
  { name: 'Numbers', items: NUMBERS },
  { name: 'Whitespace', items: WHITESPACE },
  { name: 'Modifiers', items: MODIFIERS },
  { name: 'Symbols', items: SYMBOLS },
  { name: 'Navigation', items: NAV },
  { name: 'Function keys', items: FN_KEYS },
  { name: 'Media', items: MEDIA },
  { name: 'Layers', items: LAYERS },
  { name: 'Bluetooth', items: BLUETOOTH },
  { name: 'RGB', items: RGB },
  { name: 'Power & system', items: POWER },
];

type Props = {
  current: string;
  onPick: (binding: string) => void;
  onCancel: () => void;
  position: number;
  layerName: string;
};

export function BindingPicker({ current, onPick, onCancel, position, layerName }: Props) {
  const [raw, setRaw] = useState(current);
  const [filter, setFilter] = useState('');
  const lowered = filter.toLowerCase();

  const matches = (label: string, value: string) =>
    !lowered || label.toLowerCase().includes(lowered) || value.toLowerCase().includes(lowered);

  const groupsFiltered = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => matches(it.label, it.value)),
  })).filter((g) => g.items.length > 0);

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
          width: 'min(780px, 100%)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong>
              {layerName} · position {position}
            </strong>
            <span style={{ color: 'var(--fg-dim)', fontSize: 12 }}>
              current: <code>{current}</code>
            </span>
          </div>
          <input
            type="text"
            value={filter}
            placeholder="Search bindings…"
            onChange={(e) => setFilter(e.target.value)}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '6px 10px',
              background: 'var(--bg-elev-2)',
              color: 'var(--fg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
            autoFocus
          />
        </header>
        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          {groupsFiltered.map((g) => (
            <div key={g.name} style={{ marginBottom: 18 }}>
              <h3
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--fg-dim)',
                  margin: '0 0 8px',
                }}
              >
                {g.name}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {g.items.map((it) => (
                  <button
                    key={it.value}
                    onClick={() => onPick(it.value)}
                    title={it.value}
                    style={{
                      padding: '4px 10px',
                      fontSize: 13,
                      background: it.value === current ? 'var(--accent)' : 'var(--bg-elev-2)',
                      color: it.value === current ? '#0b1220' : 'var(--fg)',
                    }}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <h3
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--fg-dim)',
                margin: '0 0 8px',
              }}
            >
              Raw devicetree
            </h3>
            <p style={{ color: 'var(--fg-dim)', fontSize: 12, margin: '0 0 6px' }}>
              For anything not in the lists above — must start with <code>&behavior</code>.
            </p>
            <input
              type="text"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontFamily: 'ui-monospace, monospace',
                background: 'var(--bg-elev-2)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            />
          </div>
        </div>
        <footer
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={() => onPick(raw)}
            disabled={!/^&[A-Za-z_][A-Za-z0-9_]*/.test(raw.trim())}
          >
            Use raw value
          </button>
        </footer>
      </div>
    </div>
  );
}
