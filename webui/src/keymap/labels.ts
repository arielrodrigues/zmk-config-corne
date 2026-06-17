import type { Binding } from '../types';

const KEYCODES: Record<string, string> = {
  // Letters and digits — included for completeness via fallthrough below.
  // Arrows
  LEFT: '←', DOWN: '↓', UP: '↑', RIGHT: '→',
  // Whitespace / control
  SPACE: 'Space', RET: 'Enter', ENT: 'Enter', ENTER: 'Enter',
  TAB: 'Tab', ESC: 'Esc',
  BSPC: 'Bksp', BACKSPACE: 'Bksp',
  INS: 'Ins', DEL: 'Del',
  CAPS: 'Caps', CAPSLOCK: 'Caps',
  PRINTSCREEN: 'PrtSc',
  // Modifiers
  LSHFT: 'Shift', RSHFT: 'Shift',
  LCTRL: 'Ctrl', RCTRL: 'RCtrl',
  LALT: 'Alt', RALT: 'RAlt',
  LGUI: 'Super', RGUI: 'RSuper',
  // Symbols
  GRAVE: '`', TILDE: '~',
  EXCL: '!', AT: '@', HASH: '#', DLLR: '$', PRCNT: '%',
  CARET: '^', AMPS: '&', ASTRK: '*',
  LPAR: '(', RPAR: ')',
  MINUS: '-', UNDER: '_',
  PLUS: '+', EQUAL: '=',
  LBKT: '[', RBKT: ']',
  LBRC: '{', RBRC: '}',
  PIPE: '|', BSLH: '\\',
  SQT: "'", DQT: '"',
  SEMI: ';', COLON: ':',
  COMMA: ',', DOT: '.',
  FSLH: '/', QMARK: '?',
  LT: '<', GT: '>',
  // Media
  C_PLAY_PAUSE: '⏯', C_NEXT: '⏭', C_PREVIOUS: '⏮',
  K_MUTE: '🔇', C_VOL_UP: '🔊', C_VOL_DN: '🔉',
  C_BRIGHTNESS_INC: '🔆', C_BRIGHTNESS_DEC: '🔅',
};

// N0..N9 → "0".."9"; F1..F24 → "F1".."F24"; A..Z → "A".."Z".
function fallbackKey(code: string): string {
  if (/^N(\d)$/.test(code)) return code.slice(1);
  if (/^F\d{1,2}$/.test(code)) return code;
  if (/^[A-Z]$/.test(code)) return code;
  return code;
}

function rgbCmdLabel(cmd: string): string {
  switch (cmd) {
    case 'RGB_TOG': return 'RGB Tog';
    case 'RGB_EFF': return 'Eff +';
    case 'RGB_EFR': return 'Eff −';
    case 'RGB_BRI': return 'Br +';
    case 'RGB_BRD': return 'Br −';
    case 'RGB_HUI': return 'Hue +';
    case 'RGB_HUD': return 'Hue −';
    case 'RGB_SAI': return 'Sat +';
    case 'RGB_SAD': return 'Sat −';
    case 'RGB_SPI': return 'Spd +';
    case 'RGB_SPD': return 'Spd −';
    case 'RGB_ON': return 'RGB On';
    case 'RGB_OFF': return 'RGB Off';
    default: return cmd;
  }
}

function btCmdLabel(cmd: string, arg?: string): string {
  switch (cmd) {
    case 'BT_SEL': return `BT ${arg ?? '?'}`;
    case 'BT_CLR': return 'BT Clr';
    case 'BT_CLR_ALL': return 'BT ClrAll';
    case 'BT_NXT': return 'BT →';
    case 'BT_PRV': return 'BT ←';
    default: return cmd;
  }
}

export function labelFor(b: Binding): { label: string; sub?: string } {
  switch (b.behavior) {
    case '&kp': {
      const code = b.args[0] ?? '';
      const known = KEYCODES[code];
      return { label: known ?? fallbackKey(code) };
    }
    case '&mo':
      return { label: 'MO', sub: (b.args[0] ?? '').replace(/_L$/, '') };
    case '&trans':
      return { label: '▽' };
    case '&none':
      return { label: '·' };
    case '&bt':
      return { label: btCmdLabel(b.args[0] ?? '', b.args[1]) };
    case '&rgb_ug':
      return { label: rgbCmdLabel(b.args[0] ?? '') };
    case '&ext_power':
      return {
        label: b.args[0] === 'EP_ON' ? 'Pwr On' : b.args[0] === 'EP_OFF' ? 'Pwr Off' : (b.args[0] ?? 'Pwr'),
      };
    case '&out':
      return { label: b.args[0] === 'OUT_USB' ? 'USB' : b.args[0] === 'OUT_BLE' ? 'BLE' : (b.args[0] ?? 'Out') };
    case '&sys_reset':
      return { label: 'Reset' };
    case '&bootloader':
      return { label: 'Boot' };
    case '&studio_unlock':
      return { label: 'Unlock' };
    default:
      return { label: b.behavior.replace(/^&/, ''), sub: b.args.join(' ') };
  }
}
