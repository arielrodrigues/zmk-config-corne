# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

The build environment requires:
- West in a Python venv: `~/zmk-venv/bin/west`
- Zephyr SDK at: `~/zephyr-sdk-0.17.0`
- ZMK source and Zephyr are already checked out under this repo (`.west/` workspace)

Build all three targets (run from the repo root):

```bash
source ~/zmk-venv/bin/activate
export ZEPHYR_SDK_INSTALL_DIR=~/zephyr-sdk-0.17.0
export ZEPHYR_TOOLCHAIN_VARIANT=zephyr
export CMAKE_PREFIX_PATH=/path/to/zmk-config-corne/zephyr/share/zephyr-package/cmake

# Left half (includes ZMK Studio support)
west build -s zmk/app -b nice_nano//zmk -d build/corne_left --pristine \
  -S studio-rpc-usb-uart \
  -- -DSHIELD=corne_left -DZMK_CONFIG=$(pwd)/config -DCONFIG_ZMK_STUDIO=y

# Right half
west build -s zmk/app -b nice_nano//zmk -d build/corne_right --pristine \
  -- -DSHIELD=corne_right -DZMK_CONFIG=$(pwd)/config

# Settings reset (no ZMKCONFIG — nice_nano.overlay references &led_strip which doesn't exist in this shield)
west build -s zmk/app -b nice_nano//zmk -d build/settings_reset --pristine \
  -- -DSHIELD=settings_reset
```

Output UF2 files land in `build/<target>/zephyr/zmk.uf2`. Flash by double-tapping reset to enter bootloader, then drag-drop the UF2 to the mounted drive.

Incremental rebuilds (omit `--pristine`) are fast. Use `--pristine` when changing `SHIELD`, `SNIPPET`, or cmake args.

To inspect preprocessor output for a `.dtsi` file (useful for debugging macros):
```bash
gcc -E config/<file.dtsi>
```

## Architecture

### Multi-OS Layer System

The firmware embeds 15 layers split across 3 OS targets — all compiled into a single firmware binary:

| OS      | Layer indices | Names                          |
|---------|---------------|-------------------------------|
| macOS   | 0–4           | mBAS, mDEV, mAXN, mFNK, mSTG |
| Windows | 5–9           | wBAS, wDEV, wAXN, wFNK, wSTG |
| Android | 10–14         | aBAS, aDEV, aAXN, aFNK, aSTG |

Every OS gets the same 5-layer structure:
- **BAS** — Base (Colemak-DHm with home-row mods)
- **DEV** — Developer symbols
- **AXN** — Actions + numpad (arrows, clipboard, numbers)
- **FNK** — Function keys, Page Up/Down/Home/End
- **STG** — Settings (BT profiles, RGB, window management, display)

Layer indices are defined in `config/os/<os>/layers.dtsi` and referenced throughout as `#define` constants (e.g. `mBAS 0`, `wBAS 5`).

### Layer Signaling to the Host

Every layer switch emits a special keycode so the host OS can track the active layer. This is the key architectural pattern:

- `TO_MACRO(OS, TO)` in `config/helpers/macros.dtsi` generates a ZMK macro that does `&to <layer>` + `&kp F_<OS><TO>`. The `F_*` codes are mapped to F13–F18 / shifted variants (defined in each `layers.dtsi`).
- `MOTO_MACRO(OS, MO, TO)` generates a momentary-hold version that emits the signal on both press and release.
- Host-side scripts in `host/windows/ahk/` (AutoHotKey) and `host/android/automate/` intercept these keycodes.

### Behavior Helpers (C Preprocessor Macros)

`config/helpers/hold.dtsi` and `config/helpers/morph.dtsi` define C macros that generate ZMK devicetree nodes:

- `HR_HOLD(OS, LYR, MOD, MP)` — generates a home-row hold-tap behavior node named `hm_<OS><LYR>_<MOD>`
- `MOTO_HOLD(OS, MO, CB, TO)` — generates a hold-tap that layers on hold, switches on tap
- `MORPH_KS / MORPH_KA / MORPH_KAS / MORPH_KASAS` — generate mod-morph chains for tap/shift/alt/alt+shift variants

All generated node names follow a consistent pattern: `mp_<OS><LYR>_<NAME>` for morphs, `hm_<OS><LYR>_<MOD>` for hold-taps, `to_<OS><LYR>` for layer macros.

### File Organization

```
config/
  corne.conf          # Kconfig: display, RGB, BT settings
  corne.keymap        # Root keymap: #includes everything
  nice_nano.overlay   # Hardware overlay: RGB chain-length = 28 (left: 27 physical LEDs + 1 phantom; right: 28)
  west.yml            # West manifest: pins zmk to main branch
  layout/             # Physical layout (ZMK Studio compatible)
  helpers/            # Reusable C macros: hold.dtsi, morph.dtsi, macros.dtsi
  os/
    shared/           # Shared behaviors, morphs, key position map, timing constants
    macos/            # macOS-specific layers, keymaps, combos, macros, morphs
    windows/          # Windows-specific (mirrors macos/ structure)
    android/          # Android-specific (mirrors macos/ structure, adds stg.dtsi)
```

Each OS subdirectory has: `layers.dtsi`, `keys.dtsi`, `keymap.dtsi`, `combos/`, `hold/`, `morph/`, `macros/`.

### Timing Constants (`config/os/shared/times.dtsi`)

All hold-tap and macro timing is centralized here:
- Home-row: `HR_TAPPING=220ms`, `HR_QUICK_TAP=125ms`, flavor `"balanced"`
- Mod-tap: `MT_TAPPING=220ms`, `MT_QUICK_TAP=200ms`, flavor `"tap-preferred"`
- Key positions for `hold-trigger-key-positions`: `KP_LEFT` / `KP_RIGHT`

### BT Profile → OS Mapping

The settings macros in `config/os/shared/macros/settings.dtsi` wire BT profiles to OS layers:
- Profiles 0–1 → macOS (`to_mBAS`)
- Profiles 2–3 → Windows (`to_wBAS`)
- Profiles 4–5 → Android (`to_aBAS`)

### ZMK Studio

The left half is built with `studio-rpc-usb-uart` snippet and `-DCONFIG_ZMK_STUDIO=y`, enabling live keymap editing over USB without reflashing. The physical layout for Studio is in `config/layout/corne.dtsi` and `config/layout/physical_layouts.dtsi`.
