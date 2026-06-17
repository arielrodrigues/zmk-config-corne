# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Rebuild

The easiest way to rebuild everything from the repo root:

```bash
./rebuild
```

This activates the venv, sets all env vars, and builds left half, right half, and settings reset with `--pristine`. UF2 files land in `build/<target>/zephyr/zmk.uf2`.

Flash by double-tapping reset to enter bootloader, then drag-drop the UF2 to the mounted drive.

## Build Environment

- West in a Python venv: `~/zmk-venv/bin/activate`
- Zephyr SDK at: `~/zephyr-sdk-0.17.0`
- ZMK source and Zephyr checked out under this repo (`.west/` workspace)

Environment variables (set once per shell session):

```bash
source ~/zmk-venv/bin/activate
export ZEPHYR_SDK_INSTALL_DIR=~/zephyr-sdk-0.17.0
export ZEPHYR_TOOLCHAIN_VARIANT=zephyr
export CMAKE_PREFIX_PATH=/Users/arielrodrigues/code/zmk-config-corne/zephyr/share/zephyr-package/cmake
```

## Manual Build Commands

```bash
# Left half (ZMK Studio support via studio-rpc-usb-uart snippet)
west build -s zmk/app -b nice_nano//zmk -d build/corne_left --pristine \
  -S studio-rpc-usb-uart \
  -- -DSHIELD=corne_left -DZMK_CONFIG=$(pwd)/config -DCONFIG_ZMK_STUDIO=y

# Right half
west build -s zmk/app -b nice_nano//zmk -d build/corne_right --pristine \
  -- -DSHIELD=corne_right -DZMK_CONFIG=$(pwd)/config

# Settings reset (clears NVS — use after major firmware/keymap changes)
west build -s zmk/app -b nice_nano//zmk -d build/settings_reset --pristine \
  -- -DSHIELD=settings_reset
```

Incremental rebuilds (omit `--pristine`) are fast. Use `--pristine` when changing `SHIELD`, `SNIPPET`, cmake args, or after adding new source files.

**Important:** `CONFIG_ZMK_USB_LOGGING=y` conflicts with the `studio-rpc-usb-uart` snippet — both claim USB. To get serial logs, build the left half without the snippet and without `-DCONFIG_ZMK_STUDIO=y`.

## Keymap

Simple 4-layer QWERTY layout in `config/corne.keymap`:

| Index | Name | Purpose |
|-------|------|---------|
| 0 | Base | QWERTY typing |
| 1 | Nav  | Numbers, arrows, F-keys |
| 2 | Sym  | Symbols, media keys |
| 3 | Adj  | BT profiles, RGB, power |

Layer activation:
- **Nav**: hold rightmost left-thumb key (`&mo NAV_L`, position 38)
- **Sym**: hold leftmost right-thumb key (`&mo SYM_L`, position 39)
- **Adj**: hold Nav + Sym simultaneously

Combos (defined in `config/corne.keymap`):
- Top-left + bottom-left outer keys → `&bootloader` (left half)
- Top-right + bottom-right outer keys → `&bootloader` (right half)
- Both inner thumb keys (38+39) → ZMK Studio unlock

## RGB Underglow

All underglow settings live in `config/corne.conf`. Rebuild both halves to apply.

| Setting | Values | Description |
|---|---|---|
| `CONFIG_ZMK_RGB_UNDERGLOW_EFF_START` | `0`=solid, `1`=breathe, `2`=spectrum, `3`=swirl | Starting effect |
| `CONFIG_ZMK_RGB_UNDERGLOW_HUE_START` | `0`–`359` | Starting hue (0=red, 85=green, 170=blue) |
| `CONFIG_ZMK_RGB_UNDERGLOW_SAT_START` | `0`–`100` | Saturation % |
| `CONFIG_ZMK_RGB_UNDERGLOW_BRT_START` | `0`–`100` | Brightness % |
| `CONFIG_ZMK_RGB_UNDERGLOW_SPD_START` | `1`–`5` | Animation speed |

Example — slow blue breathe:
```
CONFIG_ZMK_RGB_UNDERGLOW_EFF_START=1
CONFIG_ZMK_RGB_UNDERGLOW_HUE_START=170
CONFIG_ZMK_RGB_UNDERGLOW_SAT_START=100
CONFIG_ZMK_RGB_UNDERGLOW_BRT_START=60
CONFIG_ZMK_RGB_UNDERGLOW_SPD_START=2
```

RGB can also be changed live at runtime via the Adj layer keys without reflashing, but resets on power-off unless `*_START` defaults are updated.

### Adj-layer RGB controls

Runtime bindings live on the right home row of the Adj layer (`H`, `J`, `K`, `L`):

| Key | Binding | Action |
|---|---|---|
| H | `&rgb_ug RGB_TOG` | Toggle LEDs on/off |
| J | `&rgb_ug RGB_EFF` | Cycle effect (solid → breathe → spectrum → swirl) |
| K | `&rgb_ug RGB_BRD` | Brightness − (default step = 10) |
| L | `&rgb_ug RGB_BRI` | Brightness + |

`RGB_TOG` etc. require `#include <dt-bindings/zmk/rgb.h>` in `corne.keymap` — without it, the devicetree parser reports `expected number or parenthesized expression`.

The default brightness step is 10. Starting at `BRT_START=5` means one `BR−` press clamps to 0. Override with `CONFIG_ZMK_RGB_UNDERGLOW_BRT_STEP=<n>` for finer control.

### Gotcha: RGB toggle kills the OLED unless decoupled

The nice!nano v2 has a single `EXT_POWER` node (GPIO P0.13) that gates the 3.3V peripheral rail. **Both the WS2812 chain and the OLED share that rail** — there is no separate MOSFET for the LEDs on the Corne shield (`zmk/app/boards/shields/corne/boards/nice_nano_nrf52840_zmk.overlay`).

By default, `CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER=y` makes `RGB_TOG` and friends call `ext_power_disable()`, which cuts the rail and takes the OLED with it. Set:

```
CONFIG_ZMK_RGB_UNDERGLOW_EXT_POWER=n
```

…so the underglow toggle just clocks zeros to the LEDs (visually off, ~1 mA standby per chip) while the OLED stays alive. The `&ext_power EP_OFF` / `EP_ON` keymap bindings still work for manually cutting the rail, but they will also kill the OLED.

### Gotcha: ghost LEDs when the driver is disabled

Setting `CONFIG_ZMK_RGB_UNDERGLOW=n` doesn't physically power down the LEDs (their VCC is on the always-on rail). Instead it stops the SPI3 driver from initializing, leaving the data pin (P0.06) in a hi-Z reset state. Noise on the floating line latches random bits into the **first stages of the chain**, so a few LEDs near the chain start (right-hand thumb area) appear stuck on a random color.

For a truly off look, keep the driver enabled and use `ON_START=n` (or `BRT_START=0`) — the driver will actively clock zeros down the chain on boot.

## OLED Display (left half only)

The left half runs a custom LVGL status screen (`config/custom_status_screen.c`). The right half uses ZMK's built-in screen (`config/corne_right.conf`).

### Layout

```
┌─────────────────────────────────────────────┐
│ ⌨ 1  🔋                /v_v\               │  ← montserrat_14 (left) | UNSCII_8 (right)
│                         ( o.o )             │
│                          )   (              │
│ Sh Ct                     | |               │  ← montserrat_8 (mods)
└─────────────────────────────────────────────┘
```

- **Top-left** (montserrat_14): layer icon + BT profile number + battery symbol
- **Bottom-left** (montserrat_8): held modifier keys — only visible while holding Shift/Ctrl/Alt/Gui
- **Right** (lv_font_unscii_8 — monospace): animated ASCII vampire
- **Full-screen after 20 s idle**: "love you! <3" in montserrat_14 — disappears on any activity

### Layer icons

| Layer | Icon | LVGL constant |
|-------|------|---------------|
| Base  | ⌨   | `LV_SYMBOL_KEYBOARD` |
| Nav   | ↺   | `LV_SYMBOL_LOOP` |
| Sym   | ✎   | `LV_SYMBOL_EDIT` |
| Adj   | ⚙   | `LV_SYMBOL_SETTINGS` |

Defined in `layer_symbol()` in `custom_status_screen.c` — edit to remap.

### Vampire animation

Frames are 7-char-wide × 4-line ASCII art rendered in `lv_font_unscii_8` (monospace — proportional fonts make ASCII art look broken). WPM drives the animation:

| WPM | Frame |
|-----|-------|
| 0 | idle (still) |
| 1–39 | cape flap (left/right alternating) |
| 40+ | fast-fly frame |

Key constants at the top of `custom_status_screen.c`:
```c
#define LOVE_TIMEOUT_MS 20000   // ms of inactivity before love mode
#define FAST_WPM        40      // WPM threshold for fast frame
```

To change the vampire art, edit the `VAMP_*` string constants (keep 7 chars wide × 4 lines, `\n`-separated).

To change the idle message:
```c
lv_label_set_text(love_label, "your text\n here");
```

### Fonts in use

| Font | Used for |
|------|----------|
| `lv_font_montserrat_14` | info line (top-left), love message |
| `lv_font_montserrat_8` | modifier indicators (bottom-left) |
| `lv_font_unscii_8` | vampire ASCII art (monospace) |

To add a font, enable it in `config/corne.conf` (e.g. `CONFIG_LV_FONT_MONTSERRAT_16=y`) and reference `&lv_font_montserrat_16` in the `.c` file.

### How it's wired in

- `config/zephyr/module.yml` — declares the config dir as a Zephyr module so `CMakeLists.txt` is picked up
- `config/CMakeLists.txt` — compiles `custom_status_screen.c` only when `CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM=y`
- `config/corne.conf` — enables custom screen for the left half
- `config/corne_right.conf` — overrides to built-in screen for the right half

After editing `custom_status_screen.c`, an incremental left-half rebuild is enough:
```bash
west build -s zmk/app -b nice_nano//zmk -d build/corne_left \
  -S studio-rpc-usb-uart \
  -- -DSHIELD=corne_left -DZMK_CONFIG=$(pwd)/config -DCONFIG_ZMK_STUDIO=y
```

### Display rendering notes

The SSD1306 uses MONO10 pixel format with `SET_REVERSE_DISPLAY` (0xa7). This inverts colors at the hardware level:
- `lv_color_black()` → physically **white** pixels on screen
- `lv_color_white()` → physically **black** pixels on screen

All labels must use `lv_color_black()` as text color (physically white text on black background).

**Never call `lv_obj_set_style_bg_color(screen, lv_color_black(), ...)`** — this fills the background with physically white pixels (white noise).

**Never move labels at runtime** (e.g. `lv_obj_align` in a timer callback) — LVGL clears the old position using `lv_color_black()`, leaving white pixel trails. Keep all labels at fixed positions.

### Critical config

The system work queue runs all display work. These values in `corne.conf` prevent stack overflows and LVGL OOM crashes:
```
CONFIG_SYSTEM_WORKQUEUE_STACK_SIZE=4096
CONFIG_LV_Z_MEM_POOL_SIZE=8192
```

Do not reduce these.

## ZMK Studio

The left half is built with the `studio-rpc-usb-uart` snippet and `-DCONFIG_ZMK_STUDIO=y`, enabling live keymap editing over USB without reflashing. Physical layout for Studio: `config/layout/corne.dtsi` and `config/layout/physical_layouts.dtsi`.
