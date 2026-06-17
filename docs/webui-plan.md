# WebUI Build Plan

A complete, self-contained build plan for the keyboard configuration webapp. Written so an agent (or human) with no prior context on this conversation can pick a phase, execute it, mark it done, and hand off.

**Read this top to bottom before starting any phase.** Then jump to the [Status board](#status-board) for the current state, pick the next "Not started" phase, and follow its [Phase delivery plan](#phase-delivery-plan) section.

---

## 1. Mission

Build a local webapp for editing this ZMK Corne keyboard's configuration without hand-editing source files. Target user: **someone who owns this keyboard and wants to tweak it without learning devicetree, Kconfig, or LVGL.** The UI must be self-documenting — every setting explains itself, and a bundled docs section teaches the underlying concepts.

The app also runs the existing `./rebuild` and `./generate-kle` scripts and streams their output to the browser.

### Non-goals

- Replacing ZMK Studio for live keymap editing. Studio is already enabled on the left half (`-DCONFIG_ZMK_STUDIO=y`). We render the keymap visually and allow careful edits, but Studio remains the recommended path for frequent keymap changes.
- Cross-platform desktop packaging. This is a local dev tool. `npm run dev` on the user's Mac is sufficient.
- Authentication. Localhost only. Do not bind the server to `0.0.0.0`.
- Editing files outside the repo.

---

## 2. Audience and tone for documentation

The docs section in the webapp is written for **humans who own this keyboard**, not developers. Assume:

- They know what a mechanical keyboard is.
- They do **not** know what devicetree, Kconfig, LVGL, or ZMK shields are.
- They are comfortable opening a terminal to run `./rebuild` (we tell them what to type).
- They want to know: *what does this setting do, what happens if I change it, will it break something*.

When writing docs:

- Prefer real examples over abstractions.
- Show before/after where useful (screenshots, diffs, color swatches).
- Flag gotchas inline. Don't make readers find them in a separate troubleshooting doc.
- Avoid jargon. When unavoidable, define it on first use.

---

## 3. Repository context

This section is a snapshot of the codebase that the webapp will read from and write to. Verify each file still exists before relying on this — files may have moved.

### Where the keyboard config lives

| File | Purpose |
|---|---|
| `config/corne.conf` | Kconfig flags for the left/central half. Includes RGB underglow, OLED display, BT, battery, debounce. Source of truth for all `*_START` defaults. |
| `config/corne_right.conf` | Kconfig overrides for the right/peripheral half. Mostly disables the custom screen so the right OLED uses ZMK's built-in. |
| `config/corne.keymap` | The keymap — devicetree syntax. 4 layers (Base/Nav/Sym/Adj), combos, layer activation logic. |
| `config/custom_status_screen.c` | The left OLED's LVGL status screen. Vampire ASCII art frames, layer icons, idle "love" message, modifier indicators. |
| `config/CMakeLists.txt` | Compiles `custom_status_screen.c` when `CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y`. |
| `config/zephyr/module.yml` | Declares the config dir as a Zephyr module. |
| `config/west.yml` | West manifest. Pulls upstream `zmk` from GitHub. |
| `config/layout/*.dtsi` | Physical layout for ZMK Studio. |
| `config/nice_nano.overlay` | Devicetree overlay for nice!nano-specific tweaks. |
| `rebuild` | Bash script: activates venv, sets env vars, builds left half (with studio snippet), right half, and settings_reset — all `--pristine`. |
| `generate-kle` | Python script: parses `corne.keymap`, emits a [keyboard-layout-editor.com](https://www.keyboard-layout-editor.com) Raw Data config that visualizes Base/Nav/Sym mappings on a 42-key Corne. |
| `CLAUDE.md` | Developer-facing reference. RGB gotchas, OLED architecture, build commands. The webapp's docs should *not* assume the user has read this. |
| `docs/{android,macos,windows}.md` | OS-specific pairing/key remap notes. The webapp's docs section can link here from a "Connecting to your computer" page later. |

### What `./rebuild` does

```bash
# (from CLAUDE.md and the script itself)
source ~/zmk-venv/bin/activate
export ZEPHYR_SDK_INSTALL_DIR=~/zephyr-sdk-0.17.0
export ZEPHYR_TOOLCHAIN_VARIANT=zephyr
export CMAKE_PREFIX_PATH=$REPO/zephyr/share/zephyr-package/cmake

west build -s zmk/app -b nice_nano//zmk -d build/corne_left --pristine \
  -S studio-rpc-usb-uart \
  -- -DSHIELD=corne_left -DZMK_CONFIG=$REPO/config -DCONFIG_ZMK_STUDIO=y

west build -s zmk/app -b nice_nano//zmk -d build/corne_right --pristine \
  -- -DSHIELD=corne_right -DZMK_CONFIG=$REPO/config

west build -s zmk/app -b nice_nano//zmk -d build/settings_reset --pristine \
  -- -DSHIELD=settings_reset
```

Outputs land at:
- `build/corne_left/zephyr/zmk.uf2`
- `build/corne_right/zephyr/zmk.uf2`
- `build/settings_reset/zephyr/zmk.uf2`

The script takes ~3–6 minutes total on the user's machine. Builds print progress to stdout. Errors land on stderr.

### What `./generate-kle` does

Reads `config/corne.keymap`, parses the BASE/NAV/SYM layer bindings, and prints to stdout a JSON-ish array (KLE raw format) where each key cell shows:
- top-left = NAV layer label (left thumb held)
- top-right = SYM layer label (right thumb held)
- center = Base layer key

The user pipes the output (typically into pasteboard) and pastes it into the Raw Data tab on keyboard-layout-editor.com to visualize the layout.

It has a `KEYCODE_LABELS` dict mapping ZMK keycodes to human labels. Read the script header before extending it.

### Current keymap shape (Corne, 42 keys)

42 positions total:
- 36 regular keys: 12 (top row) + 12 (home row) + 12 (bottom row)
- 6 thumb keys: 3 per side

Layer indices (set as `#define` in `corne.keymap`):
- `BASE = 0` — QWERTY
- `NAV_L = 1` — numbers, arrows, F-keys
- `SYM_L = 2` — symbols, media keys
- `ADJ_L = 3` — BT profiles, RGB, power, system

Layer activation:
- **Nav**: hold position 38 (`&mo NAV_L` on left thumb)
- **Sym**: hold position 39 (`&mo SYM_L` on right thumb)
- **Adj**: hold both Nav and Sym simultaneously

Combos (current):
- positions 0+24 → `&bootloader` (left half)
- positions 11+35 → `&bootloader` (right half)
- positions 38+39 → `&studio_unlock` (Base layer only)

### Current OLED constants (`custom_status_screen.c`)

```c
// Around line 44:
static const char VAMP_IDLE[]  = " /v_v\\ \n( o.o )\n )   ( \n  | |  ";
static const char VAMP_LEFT[]  = " /v_v\\ \n( >.< )\n/)   ( \n  | |  ";
static const char VAMP_RIGHT[] = " /v_v\\ \n( <.> )\n )   (\\\n  | |  ";
static const char VAMP_FAST[]  = " /v_v\\ \n(*^.^*)\n/~~~~~\\\n  / \\  ";

// Around line 73:
#define LOVE_TIMEOUT_MS 20000   // ms of inactivity before love mode
#define FAST_WPM        40      // WPM threshold for fast frame

// Around line 311:
lv_label_set_text(love_label, "love u!");
```

Verify exact line numbers before parsing — they shift with edits. Parsers should anchor on the symbol name (e.g., `LOVE_TIMEOUT_MS`), never on line number.

---

## 4. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | React 18 + TypeScript | User requested React. TS catches parser/contract bugs early. |
| Bundler/dev server | Vite 5 | Fast, zero-config, native TS support, easy proxy to backend. |
| Backend | Node 20+ with Express 4 + TypeScript | Same language as frontend, simple file IO and process spawning. |
| Streaming | Server-Sent Events (SSE) | Simpler than WebSockets, one-way is what we need, native EventSource in browser. |
| Markdown rendering | `react-markdown` + `remark-gfm` | Renders GitHub-flavored markdown for the in-app docs. |
| Routing | `react-router-dom` v6 | Section navigation (Editors / Docs / Build). |
| Color picker | `react-colorful` or hand-rolled HSL sliders | Used by RGB editor. Decide in Phase 2. |
| Styling | Plain CSS modules (no Tailwind, no UI lib) | Minimal deps. UI is small and one-author. |
| Testing | `vitest` + `@testing-library/react` for parsers and components | Optional but recommended for parsers — they round-trip user files. |
| Lint/format | `prettier` defaults + `eslint` with `@typescript-eslint` minimal config | Keep config short. |

Avoid pulling in:
- State management libs (Redux, Zustand) — local React state is enough.
- CSS-in-JS — overkill.
- UI component libraries — every interactive widget is small enough to hand-write, and consistency matters less than control.

### Versions to install

Pin major versions in `package.json` but allow minor/patch:
- `react@^18`
- `vite@^5`
- `express@^4`
- `typescript@^5`
- `react-router-dom@^6`
- `react-markdown@^9`
- `remark-gfm@^4`

Use `npm` (not pnpm/yarn) unless the user specifies otherwise — it's pre-installed on macOS via Node.

---

## 5. Repository layout

The webapp lives entirely under `webui/`. Do not touch files outside `webui/` and `docs/webui-plan.md` (this file).

```
webui/
├── README.md                       # how to run the dev server, build for production
├── package.json                    # frontend + scripts (dev, build, lint)
├── tsconfig.json
├── vite.config.ts                  # proxies /api/* to backend on :5174
├── index.html
├── .eslintrc.cjs
├── .prettierrc
│
├── server/                         # backend
│   ├── package.json                # express + ts-node, runs on :5174
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # express app entrypoint
│   │   ├── repoRoot.ts             # resolves repo root from __dirname
│   │   ├── runner.ts               # spawn script + SSE stream helper
│   │   ├── routes/
│   │   │   ├── config.ts           # GET/PUT /api/config
│   │   │   ├── oled.ts             # GET/PUT /api/oled
│   │   │   ├── keymap.ts           # GET/PUT /api/keymap
│   │   │   ├── build.ts            # POST /api/rebuild (SSE)
│   │   │   ├── kle.ts              # POST /api/generate-kle (SSE)
│   │   │   └── docs.ts             # GET /api/docs and /api/docs/:slug
│   │   └── parsers/
│   │       ├── kconfig.ts          # corne.conf round-trip
│   │       ├── oled.ts             # custom_status_screen.c constants
│   │       └── keymap.ts           # corne.keymap layers + combos
│   └── tests/
│       ├── kconfig.test.ts
│       ├── oled.test.ts
│       └── keymap.test.ts
│
├── src/                            # frontend
│   ├── main.tsx
│   ├── App.tsx                     # router + layout
│   ├── api.ts                      # typed fetch wrappers
│   ├── types.ts                    # shared types between FE and BE (mirror server/src/parsers types)
│   ├── styles/
│   │   ├── global.css
│   │   └── *.module.css per component
│   ├── components/
│   │   ├── Layout.tsx              # sidebar nav, content area
│   │   ├── BuildPanel.tsx          # rebuild + generate-kle buttons + live log
│   │   ├── RGBEditor.tsx
│   │   ├── OLEDEditor.tsx
│   │   ├── VampireFrameEditor.tsx
│   │   ├── KeymapViewer.tsx        # read-only render, phase 5a
│   │   ├── KeymapEditor.tsx        # binding swap, phase 5b
│   │   ├── DocsViewer.tsx          # markdown renderer
│   │   ├── DiffPreview.tsx         # shows before/after for a file write
│   │   ├── InfoTooltip.tsx         # reusable help widget
│   │   └── primitives/             # button, slider, dropdown, etc.
│   └── docs/                       # markdown sources (bundled at build time OR served from server)
│
└── docs/                           # if not bundled, served by backend
    ├── getting-started.md
    ├── anatomy.md
    ├── layers.md
    ├── rgb.md
    ├── oled.md
    ├── combos.md
    ├── build-flash.md
    ├── studio.md
    ├── troubleshooting.md
    └── _toc.json                   # ordered list for sidebar
```

**Decision: docs are served by the backend** (not bundled into the Vite build). This way edits to docs reflect without restarting Vite, and the backend can serve them statically.

---

## 6. Backend design

### Server entrypoint

`webui/server/src/index.ts`:

- Express app on port `5174`.
- Bind only to `127.0.0.1`.
- JSON body parser, `express.json({ limit: '1mb' })`.
- Mount routes under `/api`.
- Serve docs markdown from `<repoRoot>/webui/docs` (or wherever they live — see [docs/_toc.json](#docs)).
- No CORS needed because Vite proxies `/api` to the backend.

### Repo root resolution

`webui/server/src/repoRoot.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// here = .../webui/server/src
export const REPO_ROOT = path.resolve(here, '..', '..', '..');
```

Test: assert `REPO_ROOT` contains a `config/corne.keymap` file on boot.

### Process runner (SSE)

`webui/server/src/runner.ts`:

A reusable helper to spawn a script and stream its stdout/stderr to an SSE response.

```ts
function streamScript(
  res: Response,
  script: string,  // absolute path
  args: string[] = [],
): void
```

Behavior:
- Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- `spawn(script, args, { cwd: REPO_ROOT, env: process.env })`.
- For each `stdout`/`stderr` line, send `event: log\ndata: {"stream":"stdout","line":"..."}\n\n`.
- On `close(code)`, send `event: done\ndata: {"exitCode":code}\n\n`, then `res.end()`.
- On client disconnect (`req.on('close')`), `child.kill('SIGTERM')`.

Reuse this helper for both `/api/rebuild` and `/api/generate-kle`.

### Path safety

Every write goes to a known absolute path *inside* `REPO_ROOT`. Reject any request that includes path segments — the routes have hardcoded targets. Never accept a filename from the client.

### Atomic writes

Use `fs.writeFile` with a temp file + rename:

```ts
const tmp = `${target}.tmp.${process.pid}`;
await fs.writeFile(tmp, content, 'utf8');
await fs.rename(tmp, target);
```

Prevents partially-written files if the process is killed mid-write.

---

## 7. Parsers

All parsers live under `webui/server/src/parsers/`. Each:

1. Exports a `parse(text: string)` returning a typed model.
2. Exports a `serialize(model)` returning text.
3. Round-trips: `serialize(parse(text)) === text` for any unchanged input.
4. Preserves comments, whitespace, and ordering.

Each parser has a corresponding `.test.ts` with at least: round-trip identity, single-field mutation, malformed-input handling.

### 7.1 Kconfig parser (`corne.conf`)

Format: one setting per line. Lines are:

- Blank — preserve.
- Comment (`# ...`) — preserve.
- Setting (`KEY=value`) — parse.

Values:
- `y` / `n` → boolean.
- Integer → number.
- Quoted string → string.
- Unquoted token → string (rare).

Model:

```ts
type KconfigLine =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | { kind: 'setting'; key: string; value: string; raw: string };

type Kconfig = {
  lines: KconfigLine[];
  // index for O(1) lookup; rebuilt after mutation
  bySettingKey: Map<string, number>;
};

function get(k: Kconfig, key: string): string | undefined;
function set(k: Kconfig, key: string, value: string): void;  // updates or appends
function unset(k: Kconfig, key: string): void;
```

API surface for the frontend (after parsing):

```ts
type RGBConfig = {
  enabled: boolean;            // CONFIG_ZMK_RGB_UNDERGLOW
  onStart: boolean;            // CONFIG_ZMK_RGB_UNDERGLOW_ON_START
  extPower: boolean;           // CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER (default: false in our repo)
  effect: 0 | 1 | 2 | 3;       // EFF_START
  hue: number;                 // 0..359
  saturation: number;          // 0..100
  brightness: number;          // 0..100
  speed: 1 | 2 | 3 | 4 | 5;
  brightnessStep?: number;     // CONFIG_ZMK_RGB_UNDERGLOW_BRT_STEP
};

type ConfigPayload = {
  rgb: RGBConfig;
  flags: Record<string, boolean | number | string>;  // raw access to other settings
  raw: string;                                       // full file text (for diff preview)
};
```

The frontend should only edit known fields. Unknown settings remain in `flags` and are preserved on write.

### 7.2 OLED constants parser (`custom_status_screen.c`)

Read the whole file as a string. Anchor on symbols, not line numbers.

Extract:

```ts
type OLEDConfig = {
  loveTimeoutMs: number;        // #define LOVE_TIMEOUT_MS <n>
  fastWpm: number;              // #define FAST_WPM <n>
  loveText: string;             // lv_label_set_text(love_label, "<text>")
  vampireFrames: {
    idle: string;               // VAMP_IDLE
    left: string;               // VAMP_LEFT
    right: string;              // VAMP_RIGHT
    fast: string;               // VAMP_FAST
  };
  raw: string;
};
```

Regexes (anchored on symbol):

- `/#define\s+LOVE_TIMEOUT_MS\s+(\d+)/`
- `/#define\s+FAST_WPM\s+(\d+)/`
- `/lv_label_set_text\(\s*love_label\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/`
- `/static\s+const\s+char\s+VAMP_(IDLE|LEFT|RIGHT|FAST)\s*\[\s*\]\s*=\s*("(?:[^"\\]|\\.)*")\s*;/g`

For VAMP_* strings: parse the C string literal (including `\n`, `\\`) into a real string with literal newlines (7 chars × 4 lines). For the editor, expose this as 4 lines × 7 chars. When serializing back, re-encode `\n` → `\\n` and `\` → `\\`, wrap with `"..."`.

For `loveText`: same string-literal decode/encode.

### 7.3 Keymap parser (`corne.keymap`)

The hardest parser. **Two modes:**

- **Read mode (Phase 5a — viewer):** extract layer bindings as a list of bindings per layer. Lossy is OK for display.
- **Edit mode (Phase 5b — editor):** surgical token replacement only. Do not regenerate the file from a model. Preserve all comments, whitespace, custom dt nodes (combos, etc.).

Model:

```ts
type Binding =
  | { behavior: '&kp'; args: [string] }
  | { behavior: '&mo'; args: [string] }
  | { behavior: '&trans'; args: [] }
  | { behavior: '&none'; args: [] }
  | { behavior: '&bt'; args: [string, ...string[]] }    // BT_SEL N, BT_CLR, BT_CLR_ALL, BT_PRV, BT_NXT
  | { behavior: '&rgb_ug'; args: [string] }
  | { behavior: '&ext_power'; args: [string] }
  | { behavior: '&out'; args: [string] }
  | { behavior: '&sys_reset'; args: [] }
  | { behavior: '&bootloader'; args: [] }
  | { behavior: '&studio_unlock'; args: [] }
  | { behavior: string; args: string[] };               // fallback for unknown

type Layer = {
  name: string;        // e.g. 'default_layer'
  displayName: string; // e.g. 'Base' (from display-name)
  bindings: Binding[]; // 42 bindings for Corne, ordered by position
  // For edit mode: per-binding character ranges in the source string
  ranges?: Array<{ start: number; end: number }>;
};

type Combo = {
  name: string;            // e.g. 'combo_studio_unlock'
  timeoutMs: number;
  keyPositions: number[];
  binding: Binding;        // single binding
  layers?: number[];       // restricted layers, if specified
};

type Keymap = {
  layers: Layer[];
  combos: Combo[];
  raw: string;             // for diff preview and surgical edits
};
```

#### Reading layers

For each layer block (regex: `/(\w+)_layer\s*\{[^}]*?bindings\s*=\s*<([\s\S]*?)>\s*;/g`):

1. Capture the layer node name.
2. Capture the `display-name` from inside the block (regex: `/display-name\s*=\s*"([^"]+)"/`).
3. Tokenize the bindings block:
   - Skip whitespace.
   - When you hit `&`, read until next whitespace → that's the behavior token.
   - Read args until next `&` or end.
   - Behavior arities are mostly known (see [Binding](#74-keymap-parser-cornekeymap) model); fall back to "greedy until next `&`".

#### Surgical edit (for Phase 5b)

To change the binding at a given layer + position:

1. Re-parse to locate that binding's exact `(start, end)` offsets in `raw`.
2. Build the new binding text exactly as it should appear (`'&kp B'`, `'&rgb_ug RGB_TOG'`, etc.).
3. Splice: `raw.slice(0, start) + newText + raw.slice(end)`.
4. Write back.

Pad with spaces to roughly match the surrounding column alignment if possible — purely cosmetic, not required for correctness.

#### Combos parsing (read-only initially)

For Phase 5a/5b, combos are read-only. Render them in the keymap viewer (highlight key positions when hovering a combo entry). Editing combos = Phase 5c (deferred).

#### Things NOT to support yet

- `&mt`, `&lt`, custom behaviors with parameters.
- Macros (`ZMK_MACRO(...)`).
- Multi-token expressions like `&kp LS(LALT)`.

When a binding doesn't match a known pattern, render it as a non-editable "advanced" cell with the raw text. The user can still edit the file by hand.

---

## 8. Frontend design

### App shell

`App.tsx`:

- Router with routes: `/`, `/build`, `/rgb`, `/oled`, `/vampire`, `/keymap`, `/docs`, `/docs/:slug`.
- Sidebar `Layout`:
  - **Editors** group: RGB, OLED, Vampire frames, Keymap.
  - **Build** group: Rebuild, Generate KLE.
  - **Docs** group: collapsible list from `/api/docs` TOC.
- Top-right: a small "unsaved changes" indicator and a "Save & Diff" button that's enabled when current editor has dirty state.

### State model

Each editor owns its own state. No global store needed.

Editor pattern:

```ts
const { data, isLoading, error, save } = useApi('/api/config');
// data starts as the server's current state.
// User edits → local state diverges → "dirty" badge appears.
// "Save & Diff" opens DiffPreview modal showing before/after.
// Confirm → PUT → reload data.
```

### DiffPreview

A modal that shows the current file vs. proposed file. Use a simple line-based diff (no external lib needed — split lines, mark added/removed). Highlight: green for additions, red for deletions, gray for context.

This is the user's "are you sure" moment. Don't skip it — these files are checked into git and a bad write is annoying to recover.

### BuildPanel

`BuildPanel.tsx`:

- Two buttons: **Rebuild firmware** and **Generate KLE**.
- Below each: a terminal-style log area (`pre` element, monospace, dark background).
- Clicking a button:
  1. Disables both buttons.
  2. Opens an `EventSource('/api/rebuild')` (or `/api/generate-kle`).
  3. Appends each `log` event to the log area.
  4. On `done`, re-enables buttons and shows exit code with green/red banner.
- After Rebuild: show paths to UF2 files with a "Reveal in Finder" hint (just text — we can't actually open Finder from a browser). Also show the flashing instructions: "double-tap reset, drag UF2 to the mounted drive."
- After Generate KLE: show the raw output with a **Copy to clipboard** button and a link to https://www.keyboard-layout-editor.com with instructions.

### InfoTooltip

A small `(i)` icon that, on hover/focus, shows a `Popover` with explanatory text. Used everywhere settings appear. Each tooltip text lives in a constants file (`src/help.ts`) keyed by setting name, so docs and tooltips share a source of truth.

### Help text source of truth

`src/help.ts`:

```ts
export const HELP = {
  'rgb.enabled': {
    short: 'Turn the LED driver on or off entirely.',
    long: '...explanation linking to docs/rgb.md...',
    learnMoreSlug: 'rgb',
  },
  // ...one entry per setting
};
```

### Editors

#### RGBEditor

Layout:

- **Effect** dropdown: Solid (0), Breathe (1), Spectrum (2), Swirl (3). Each option has a one-line description ("Steady color, no animation — best battery").
- **Color picker**: HSL sliders for Hue (0–359), Saturation (0–100), Brightness (0–100). Show a swatch preview.
- **Speed** slider: 1–5. Disabled and grayed out when effect = Solid.
- **Brightness step** input (advanced, collapsed by default).
- **Toggles**: "Start LEDs on at boot", "Allow LED toggle to cut peripheral power" (this is the `EXT_POWER` flag — strongly recommend leaving off, explain why).
- **Save** button → DiffPreview → PUT.

Reflect changes in the swatch live. Speed slider has no visual preview; just shows the value.

#### OLEDEditor

- Idle text input. Multiline allowed.
- **LOVE_TIMEOUT_MS** as a "seconds" input (display `value / 1000`, store `value * 1000`).
- **FAST_WPM** as a plain number input.
- Save → DiffPreview → PUT.

#### VampireFrameEditor

- 4 tabs (Idle / Left / Right / Fast).
- Each shows a 4-row × 7-col text grid. Use a grid of `<input maxLength={1}>` for cell-level editing, OR a single `<textarea>` constrained to 4 lines × 7 chars (simpler — start here).
- Live preview to the right showing the frame in monospace, sized to roughly match the OLED.
- Validation: each line must be ≤ 7 chars (warn if longer — the OLED will clip).
- Save → DiffPreview → PUT.

#### KeymapViewer (Phase 5a)

- Render the 42-key Corne layout as SVG.
- Tabs for layers: Base / Nav / Sym / Adj.
- Each key shows the binding for the current layer.
- Hovering a key shows what it does on all 4 layers in a tooltip.
- Show combos as overlays (e.g., a dotted line connecting the keys in a combo, with the resulting binding as a label).
- A **Generate KLE** button shortcut here too (alias for BuildPanel).

#### KeymapEditor (Phase 5b)

Extends KeymapViewer:

- Click a key to open a binding-picker popover.
- Picker shows a categorized list:
  - **Letters** (A-Z)
  - **Numbers** (N0-N9)
  - **Modifiers** (LSHFT, LCTRL, LALT, LGUI, ...)
  - **Navigation** (LEFT, RIGHT, UP, DOWN, HOME, END, ...)
  - **Function keys** (F1-F24)
  - **Media** (C_PLAY_PAUSE, C_NEXT, ...)
  - **Symbols** (EXCL, AT, ...)
  - **Layers** (`&mo` + layer dropdown)
  - **Bluetooth** (`&bt` + command)
  - **RGB** (`&rgb_ug` + command)
  - **Power** (`&ext_power`, `&sys_reset`, `&bootloader`)
  - **None / Transparent** (`&none`, `&trans`)
  - **Advanced (raw)** — text input for one binding, no parsing
- Save → DiffPreview → PUT.
- After Save: prompt "Rebuild now?" linking to BuildPanel.

---

## 9. API contract

All requests/responses are JSON unless noted.

### `GET /api/config`

Response 200:

```json
{
  "rgb": { "enabled": true, "onStart": true, "extPower": false,
           "effect": 0, "hue": 0, "saturation": 100,
           "brightness": 5, "speed": 1, "brightnessStep": 10 },
  "flags": { "CONFIG_BT_CTLR_TX_PWR_PLUS_8": true,
             "CONFIG_SYSTEM_WORKQUEUE_STACK_SIZE": 4096 /* etc */ },
  "raw": "...full file text..."
}
```

### `PUT /api/config`

Request body: same shape as above (minus `raw`). Server merges into existing settings (preserves unknowns), serializes, atomically writes `config/corne.conf`. Returns the updated payload (same shape as GET).

### `GET /api/oled`

Response 200:

```json
{
  "loveTimeoutMs": 20000,
  "fastWpm": 40,
  "loveText": "love u!",
  "vampireFrames": {
    "idle":  " /v_v\\ \n( o.o )\n )   ( \n  | |  ",
    "left":  " /v_v\\ \n( >.< )\n/)   ( \n  | |  ",
    "right": " /v_v\\ \n( <.> )\n )   (\\\n  | |  ",
    "fast":  " /v_v\\ \n(*^.^*)\n/~~~~~\\\n  / \\  "
  },
  "raw": "...full C file text..."
}
```

### `PUT /api/oled`

Body: same minus `raw`. Server splices in the new values, atomically writes `config/custom_status_screen.c`. Returns GET response.

### `GET /api/keymap`

Response 200:

```json
{
  "layers": [
    { "name": "default_layer", "displayName": "Base",
      "bindings": [ { "behavior": "&kp", "args": ["GRAVE"] }, /* 42 entries */ ] },
    /* ... 3 more layers ... */
  ],
  "combos": [
    { "name": "combo_studio_unlock", "timeoutMs": 50,
      "keyPositions": [38, 39],
      "binding": { "behavior": "&studio_unlock", "args": [] },
      "layers": [0] }
  ],
  "raw": "...full keymap text..."
}
```

### `PUT /api/keymap`

Body shape:

```json
{
  "edits": [
    { "layer": "default_layer", "position": 18, "newBinding": "&rgb_ug RGB_TOG" }
  ]
}
```

Server applies each edit surgically to `raw` and writes the file. **Do not** accept a full keymap model — that would force regenerating the file and risk losing custom dt. Return the GET response after applying.

If an edit references a position that doesn't exist or a layer that doesn't exist, return `400`.

### `POST /api/rebuild`

SSE stream. Headers:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Events:

```
event: log
data: {"stream":"stdout","line":"==> Building left half..."}

event: log
data: {"stream":"stderr","line":"warning: ..."}

event: done
data: {"exitCode":0}
```

Closes after `done`. If client disconnects, `SIGTERM` the child.

### `POST /api/generate-kle`

Same SSE shape. The final stdout lines together form the KLE Raw Data — frontend reassembles by concatenating `stdout` lines. Provide a hint header line in the stream (e.g., `event: kle\ndata: {"output":"..."}\n`) at the end if cleaner, but log streaming is sufficient.

### `GET /api/docs`

Returns the TOC:

```json
{
  "items": [
    { "slug": "getting-started", "title": "Getting Started", "group": "Start here" },
    { "slug": "anatomy", "title": "Keyboard Anatomy", "group": "Concepts" },
    /* ... */
  ]
}
```

### `GET /api/docs/:slug`

Returns:

```json
{ "slug": "rgb", "title": "RGB Underglow", "markdown": "# ..." }
```

---

## 10. Documentation track

### Where docs live

`webui/docs/*.md`. The backend reads them at request time (no restart needed for content edits). Each file has YAML frontmatter:

```markdown
---
slug: rgb
title: RGB Underglow
group: Editors
order: 30
---

# RGB Underglow

...body markdown...
```

`_toc.json` is auto-generated from frontmatter on each `GET /api/docs` request. No manual TOC maintenance.

### Outline per file

#### `getting-started.md` (Group: Start here, order 0)

- What this app is, in one paragraph.
- How to launch it: `cd webui && npm run dev`. App at `http://localhost:5173`.
- The change loop: **Edit → Save (creates a diff preview) → Confirm → Rebuild → Flash**.
- How to flash (the double-tap reset trick, drag UF2).
- "Where to start" links: RGB Editor (easiest tweak), Keymap Viewer (understand the layout), Docs section.

#### `anatomy.md` (Group: Concepts, order 10)

- Picture of a Corne (ASCII or SVG), labeled halves.
- What "split" means.
- Central vs peripheral: the **left half is central** in this config. The right half talks to the left over BLE; the left talks to your computer over BT.
- What lives where: keymap + RGB defaults + OLED code are read at build time, flashed onto each nice!nano.
- Why we build three things: left UF2, right UF2, settings reset UF2.
- When to use `settings_reset` (after big config changes, BT pairing issues).

#### `layers.md` (Group: Concepts, order 20)

- What a layer is: a complete alternate set of bindings for all 42 keys, swapped in/out by pressing a layer key.
- The 4 layers in this config with a small visual:
  - Base — QWERTY
  - Nav — numbers, arrows, F-keys (hold left thumb middle key)
  - Sym — symbols, media (hold right thumb middle key)
  - Adj — settings (hold both Nav and Sym)
- How to read a binding (`&kp Q` = "tap Q"; `&mo NAV_L` = "while held, activate Nav layer").
- Where layer keys are physically located.

#### `rgb.md` (Group: Editors, order 30)

- What underglow is. Show the hardware (WS2812 LEDs under each key on the Corne PCB).
- The four effects with side-by-side previews (gifs if possible; otherwise descriptions).
- Battery impact — why solid effects use less power than animations.
- Why low brightness saves a lot of battery (linear with brightness).
- The `ext_power` gotcha: turning LEDs off can take the OLED with it; we disable that coupling by default in our config.
- How to use the runtime Adj-layer RGB controls (H/J/K/L on Adj).
- "Ghost LEDs" warning if the underglow driver is disabled — link to `troubleshooting.md`.

#### `oled.md` (Group: Editors, order 40)

- What the left-half display shows: layer icon, BT profile, battery, vampire animation, mods row.
- The "love mode" idle screen after 20 s. Why it disappears on activity.
- How `FAST_WPM` triggers the fast frame.
- Editing the vampire frames: 7 chars × 4 lines, monospace font, hardware-inverted colors (we draw black on the screen and it appears white).
- The right half uses ZMK's built-in screen and isn't editable from this app.

#### `combos.md` (Group: Concepts, order 50)

- What a combo is (press two keys together within Nms → fire a different binding).
- The three combos in this config:
  - Top-left + Bottom-left → `&bootloader` (left half flash mode).
  - Top-right + Bottom-right → `&bootloader` (right half flash mode).
  - Both thumb middle keys → ZMK Studio unlock.
- Combos are visible in the Keymap Viewer (Phase 5).

#### `build-flash.md` (Group: Workflow, order 60)

- What `./rebuild` does (in plain English: "asks the firmware compiler to build new UF2 files for both halves").
- Why it takes a few minutes.
- The three outputs and what each is for.
- Flashing procedure with photos/ASCII of the nice!nano bootloader.
- When to use `settings_reset`: after big keymap or RGB Kconfig changes, or BT issues.
- What to do if a build fails (link to troubleshooting).

#### `studio.md` (Group: Workflow, order 70)

- ZMK Studio is the official live keymap editor over USB.
- Already enabled in this build (left half).
- How to unlock Studio: press both inner thumb keys simultaneously.
- When to use Studio vs this app:
  - Studio: changing key bindings quickly without a rebuild.
  - This app: RGB defaults, OLED tweaks, vampire art, viewing the current state.
- Studio changes are persisted to flash on the keyboard, *not* to `corne.keymap`. Be aware your `corne.keymap` and the keyboard can diverge.

#### `troubleshooting.md` (Group: Workflow, order 80)

Common issues, each with cause + fix:

- **Build fails** — verify venv, SDK paths, that `west update` has run.
- **Half won't pair** — flash `settings_reset.uf2`, re-pair.
- **OLED blank** — pressed RGB toggle? Set `CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER=n` (we already did, but if you flipped it back).
- **Ghost LEDs (a few stuck on)** — driver disabled but data line floating. Set `CONFIG_ZMK_RGB_UNDERGLOW=y` with `BRT_START=0`, or use `ON_START=n`.
- **Studio unlock doesn't work** — the unlock combo only fires on the Base layer. Make sure you're not on a held layer.
- **Battery dies fast** — drop `BRT_START`. Solid effects only. Disable animations.

### Tone reminders

Re-read [Section 2](#2-audience-and-tone-for-documentation) before writing or editing docs. Re-read after writing — anything that reads as developer jargon should be reworded or footnoted.

---

## 11. Phase delivery plan

Each phase ships as **one commit on master**, with the docs page(s) for that phase included.

### Phase 0 — Repo scaffold + docs scaffold

**Goal**: empty webapp runs, `getting-started.md` and `anatomy.md` render in the Docs section.

Deliverables:
- `webui/` directory with `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` (skeleton with router).
- `webui/server/` with `package.json`, `tsconfig.json`, `src/index.ts` (express skeleton), `src/routes/docs.ts`, `src/repoRoot.ts`.
- `webui/docs/getting-started.md`, `webui/docs/anatomy.md`.
- `webui/README.md` — how to run dev server.
- Root-level `package.json` script (in `webui/package.json`) that runs both servers concurrently (`concurrently` package).

Acceptance:
- `cd webui && npm install && npm run dev` starts both servers.
- Browser at `http://localhost:5173` shows the sidebar with the two doc entries.
- Clicking each renders the markdown.
- Sidebar has stubs for editor sections (link to a "Coming soon" placeholder).

### Phase 1 — BuildPanel (rebuild + generate-kle)

**Goal**: working buttons that stream output.

Deliverables:
- `server/src/runner.ts`.
- `server/src/routes/build.ts`, `server/src/routes/kle.ts`.
- `src/components/BuildPanel.tsx` with two SSE-consuming buttons.
- `webui/docs/build-flash.md`.

Acceptance:
- Clicking **Rebuild** streams `./rebuild` output line-by-line. After completion, shows UF2 paths and flash instructions.
- Clicking **Generate KLE** streams output and shows a "Copy to clipboard" button populated with the KLE Raw Data.
- Disconnecting the browser mid-build terminates the child process (verify with `ps` after closing the tab).

### Phase 2 — RGB Editor

**Goal**: full RGB editing with diff preview.

Deliverables:
- `server/src/parsers/kconfig.ts` + tests.
- `server/src/routes/config.ts`.
- `src/components/RGBEditor.tsx`.
- `src/components/DiffPreview.tsx`.
- `src/help.ts` (initial entries for RGB).
- `webui/docs/rgb.md`.

Acceptance:
- Editor loads current `corne.conf` values.
- Edits show a live swatch.
- Save shows a unified diff of `corne.conf` before/after.
- Confirm writes the file. Re-loading the page shows the new state.
- Unknown settings in `corne.conf` survive a write unchanged (write a test for this).

### Phase 3 — OLED Editor

**Goal**: edit `LOVE_TIMEOUT_MS`, `FAST_WPM`, love text.

Deliverables:
- `server/src/parsers/oled.ts` + tests.
- `server/src/routes/oled.ts`.
- `src/components/OLEDEditor.tsx`.
- `webui/docs/oled.md`.

Acceptance:
- Editor reads current values from the source.
- Save writes back exact same file modulo the edited values (assert with a diff test).
- Editing love text to include double-quote re-encodes correctly.

### Phase 4 — Vampire Frame Editor

**Goal**: edit the four `VAMP_*` frames.

Deliverables:
- Extend `parsers/oled.ts` to handle the frame strings.
- `src/components/VampireFrameEditor.tsx`.
- Update `webui/docs/oled.md` to cover the editor.

Acceptance:
- Frame editor shows current 4 frames.
- Editing and saving round-trips correctly: a no-op edit produces a no-op diff.
- Invalid frames (lines > 7 chars) trigger a non-blocking warning but still save.

### Phase 5a — Keymap Viewer

**Goal**: read-only visualization of all 4 layers + combos.

Deliverables:
- `server/src/parsers/keymap.ts` + tests.
- `server/src/routes/keymap.ts` (GET only).
- `src/components/KeymapViewer.tsx`.
- `webui/docs/layers.md`, `webui/docs/combos.md`.

Acceptance:
- All 4 layers render with correct bindings.
- Hovering a key shows its 4-layer mapping.
- Combos render as overlays on the layout.
- Unknown bindings (anything not in the parser's allowlist) render as the raw text with a "raw" badge.

### Phase 5b — Keymap Editor

**Goal**: click-to-edit individual bindings.

Deliverables:
- Extend `parsers/keymap.ts` with surgical edit support.
- `server/src/routes/keymap.ts` (add PUT).
- `src/components/KeymapEditor.tsx` (extends viewer).
- Update `docs/layers.md` and add `docs/studio.md`.

Acceptance:
- Clicking a key opens a binding picker.
- Save writes only the changed positions; the rest of the file is byte-identical (assert with a test).
- Combos are preserved.
- Cancel/back closes the picker without persisting.

### Phase 5c — Combo editor (deferred)

Out of scope for initial delivery. Note as future work in the app's docs.

### Phase 6 — Polish

- Keyboard shortcuts (Cmd+S to save current editor).
- Loading skeletons / error states everywhere.
- `webui/docs/troubleshooting.md`.
- Production build (`npm run build`) with backend serving `dist/` statically.

---

## 12. Testing strategy

### Parsers (required)

Each parser has at minimum:

1. **Round-trip identity**: `serialize(parse(text)) === text` for the current real file checked into the repo.
2. **Single-field mutation**: read, change one field, write, re-read, assert only that field changed.
3. **Unknown setting preservation**: add a fake `CONFIG_FAKE=y` line; mutate something else; assert the fake survives.
4. **Malformed input**: missing required setting; semantically invalid value; assert graceful failure (no exception, surfaced as a parse error in the response).

Run with `vitest`. Place fixtures in `webui/server/tests/fixtures/` — copy the real files there at test time, never mutate the live `config/` files.

### Components (recommended, not blocking)

- BuildPanel: mock `EventSource`, assert log events render and buttons disable.
- RGBEditor: assert the dirty indicator appears after an edit.
- DiffPreview: snapshot test the rendered diff for a known before/after.

### Manual smoke test before each commit

1. `npm run dev` boots cleanly.
2. Click Rebuild — completes successfully.
3. Open the editor you just modified — values reflect the current file.
4. Make a no-op edit (toggle a checkbox and toggle it back). Save. Diff is empty. File on disk unchanged.

---

## 13. Gotchas and design decisions

These are the non-obvious things. Read before implementing.

### LEDs and OLED share a power rail

On the nice!nano v2, `EXT_POWER` (GPIO P0.13) gates the 3.3V peripheral rail shared by both the WS2812 LED chain and the SSD1306 OLED. `CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER=y` (ZMK default) makes `&rgb_ug RGB_TOG` call `ext_power_disable`, which also kills the OLED.

This repo has `CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER=n` set explicitly to avoid that. The RGB editor must surface this as a toggle with a clear "leave this off unless you know why" warning.

### Ghost LEDs when the driver is disabled

`CONFIG_ZMK_RGB_UNDERGLOW=n` removes the SPI3 driver. The LED data pin (P0.06) is left floating, picks up noise, and the first stages of the WS2812 chain latch random bits. Users see "a couple of random LEDs stuck on."

Fix is to keep the driver enabled and use `ON_START=n` or `BRT_START=0`. The RGB editor should warn against fully disabling the driver and suggest `ON_START=n` instead.

### Atomic file writes are mandatory

`west` watches `config/` files; a partial write can break a parallel rebuild. Always temp-file + rename.

### Brightness step default is 10

`CONFIG_ZMK_RGB_UNDERGLOW_BRT_STEP` defaults to 10. So `BRT_START=5` + one `BR-` press → 0. The OLED currently has tooltips explaining this; the docs should too.

### The keymap is hand-written devicetree

Do not try to round-trip the keymap by serializing from a model. Even small reformats will lose information (comments, custom dt, alignment). Edit by **surgical splice only**.

### Studio diverges from corne.keymap

ZMK Studio writes changes to NVS on the keyboard, not to `corne.keymap`. A `./rebuild` will overwrite Studio changes. Flag this clearly in `docs/studio.md`.

### Brightness 0 is not "off"

`BRT_START=0` puts the brightness at zero but the WS2812 ICs still pull standby current. The total LED standby on a Corne is ~12 mA. There's no way to actually power them off without an MOSFET, which this shield doesn't have.

### Vampire frames must stay 7 chars × 4 lines

Wider lines clip; shorter lines look misaligned. The editor should warn (but not block) deviations — the user might be experimenting.

### Use `lv_font_unscii_8` for ASCII art

Proportional fonts (Montserrat) break ASCII art alignment. The vampire frames render in `lv_font_unscii_8`, monospace. The frame editor's preview must use a monospace font (any will do, since we're not pixel-matching the OLED).

### Hardware-inverted OLED colors

The SSD1306 uses `SET_REVERSE_DISPLAY (0xa7)`. `lv_color_black()` writes physically white pixels. All `custom_status_screen.c` labels use `lv_color_black()` as the text color. **Don't** call `lv_obj_set_style_bg_color(screen, lv_color_black(), ...)` — that fills the background with physically white pixels (white screen).

The OLED editor doesn't need to handle this — it just edits constants — but flag it in `docs/oled.md`.

### Don't move labels at runtime

LVGL erases old label positions with `lv_color_black()` (physically white) → white pixel trails. All labels in `custom_status_screen.c` have fixed positions and stay there. If we ever add label movement in the future, we'd need to change the inversion strategy.

### System workqueue stack size

`CONFIG_SYSTEM_WORKQUEUE_STACK_SIZE=4096` and `CONFIG_LV_Z_MEM_POOL_SIZE=8192` are required for the OLED not to crash. Do not reduce these. The OLED editor should not expose these as settings.

---

## 14. Conventions

### TypeScript

- `strict: true`.
- No `any` in committed code. Use `unknown` + narrowing.
- Named exports preferred. Default exports only for React components.

### React

- Function components only.
- Hooks must be at the top level (lint rule).
- One component per file. File name = component name in PascalCase.
- Local state with `useState`; cross-component state via prop drilling (it's small).

### Files

- File names: `kebab-case.ts` for non-components, `PascalCase.tsx` for components.
- Test files: alongside source, `.test.ts(x)`.

### Errors

- Backend: surface as JSON `{ error: { message: string, code: string } }` with appropriate HTTP status.
- Frontend: don't blow up — show an error banner with the message. Reload-the-page guidance for parsers.

### Comments

Default to no comments. Only annotate non-obvious *why*. Examples worth a comment:

- "We use surgical splice to preserve combos; do not regenerate the file from a model."
- "Anchor on symbol name, not line number — line numbers drift."

Do not write comments that restate what the code does.

### Commits

Every phase = one commit, message follows the repo convention:

```
feat(webui): phase N — short description

Optional body.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

For docs-only changes: `docs(webui): ...`. For fixes: `fix(webui): ...`.

### Don't touch outside `webui/`

The webapp must not write to `config/` directly — only through its API, which writes to the files we declared in this plan. If a phase requires touching something outside `webui/`, stop and ask.

Exception: `docs/webui-plan.md` (this file). Update the [Status board](#status-board) as phases complete.

---

## 15. Status board

Update this section as phases land. The next agent reads here first to know what to work on.

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 0 — Scaffold + docs scaffold | Done | (this commit) | Vite + Express + TS scaffold; docs API + Markdown renderer; `getting-started.md`, `anatomy.md`. Typecheck/lint/tests/manual all green. |
| 1 — BuildPanel + scripts | Done | (this commit) | SSE runner + `/api/rebuild`, `/api/generate-kle`, `/api/artifacts`. BuildPanel renders streaming logs, cancel button, copy-to-clipboard for KLE, artifact paths after rebuild. Manual smoke against real `./generate-kle` passed; 4 tests green. |
| 2 — RGB Editor | Not started | | |
| 3 — OLED Editor | Not started | | |
| 4 — Vampire Frame Editor | Not started | | |
| 5a — Keymap Viewer | Not started | | |
| 5b — Keymap Editor | Not started | | |
| 5c — Combo Editor | Deferred | | Out of initial scope |
| 6 — Polish + troubleshooting docs | Not started | | |

### How to update

When you finish a phase:

1. Set its row's Status to "Done".
2. Add the commit SHA.
3. Add a one-line note if anything in this plan turned out wrong — that's signal for the next agent.

When you start a phase, set Status to "In progress" so concurrent agents don't pick the same phase.

---

## 16. Open questions

Things to clarify with the user before they affect a phase. None currently blocking; revisit before Phase 5.

- **Phase 5 binding picker**: should we expose all ZMK behaviors, or just the ones currently used in the keymap? Defaulting to: all known + raw-input fallback for the rest.
- **Vampire frame editor format**: single textarea vs grid of 1-char inputs? Defaulting to textarea (simpler); revisit if users find it fiddly.
- **Production build**: do we need it, or is dev mode sufficient forever? Defaulting to: ship dev mode only in Phase 0–5, add prod build in Phase 6 if asked.

---

## 17. Reference: relevant ZMK / repo paths

Quick links for the implementing agent:

- ZMK upstream config docs: https://zmk.dev/docs/config
- Underglow config: https://zmk.dev/docs/config/underglow
- Display config: https://zmk.dev/docs/config/displays
- `rgb_ug` behavior: https://zmk.dev/docs/behaviors/underglow
- `ext_power` behavior: https://zmk.dev/docs/behaviors/power
- Local shield code: `zmk/app/boards/shields/corne/`
- Local nice!nano board: `zmk/app/boards/nicekeyboards/nice_nano/`
- LVGL docs (used by custom OLED): https://docs.lvgl.io/

Re-read `CLAUDE.md` at the repo root for developer-level architecture notes that complement this plan.
