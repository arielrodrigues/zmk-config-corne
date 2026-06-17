---
slug: oled
title: OLED Display
group: Editors
order: 40
---

# OLED Display

The **left half** of the keyboard has a tiny 128×32 OLED that shows a custom status screen. The right half has its own OLED but uses ZMK's built-in screen and isn't editable from this app.

The left screen layout:

```
┌──────────────────────────────────────────────┐
│  ⌨ 1  🔋                /v_v\               │
│                          ( o.o )             │
│                           )   (              │
│  Sh Ct                     | |               │
└──────────────────────────────────────────────┘
```

- **Top-left:** active layer icon + Bluetooth profile number + battery indicator.
- **Bottom-left:** which modifier keys you're holding (Shift, Ctrl, Alt, Gui).
- **Right side:** the vampire animation — pose depends on typing speed.
- **Full-screen overlay:** the love message, after a few seconds of inactivity.

## What this editor controls

### Idle love message

The text that takes over the whole screen after you stop typing for a while. Newlines are allowed. Keep it short — the 128×32 panel can fit roughly two lines of the title font.

### Idle timeout

How many seconds of no activity before the love message appears. Default is 20.

Set it to **0** to disable the love message entirely (it will appear instantly on every idle moment, so effectively, you almost never see the vampire). Set it high (e.g. 60+) if you want long focused sessions without the screen changing.

### Fast vampire WPM threshold

The vampire has three poses:

- **Idle** (0 WPM) — still, just floating.
- **Flapping cape** (1–threshold WPM) — alternates left/right as you type.
- **Fast** (above threshold) — going wild.

Default threshold is 40 WPM. Lower it (e.g. 25) if you'd like to see the fast pose more often; raise it (e.g. 60) for the opposite.

## What this editor does **not** control (yet)

- **The vampire ASCII art itself.** Edit it in the Vampire Frames editor (Phase 4 — coming).
- **Layer icons.** Defined in `custom_status_screen.c` (`layer_symbol()` function). Edit by hand for now.
- **Fonts and layout.** Same — by hand.

## Behind the scenes: a few quirks

If you ever open `custom_status_screen.c` directly, these are worth knowing.

### Hardware-inverted colors

The OLED is set to invert colors at the hardware level. In the code, you draw text with `lv_color_black()` and it shows up as **physically white** pixels on screen. This is intentional, but the consequence is: if you ever set a background color to `lv_color_black()`, you'll get a *white* screen — which is not what you want.

### No moving labels

Don't change a label's screen position at runtime. LVGL erases the old position using `lv_color_black()`, which physically draws *white* pixels — you get a trail of white smudges. All labels in our screen stay put; only their text content changes.

### Stack sizes

Two settings in `corne.conf` are sized specifically for the OLED:

```
CONFIG_SYSTEM_WORKQUEUE_STACK_SIZE=4096
CONFIG_LV_Z_MEM_POOL_SIZE=8192
```

Don't lower these or LVGL will crash or run out of memory. There's no editor for them on purpose.

## Doesn't show up after flashing?

- Did you flash the **left** UF2? The right half uses a different screen and ignores these settings.
- Did you turn the LED toggle on with **Allow LED toggle to cut peripheral power** enabled in the RGB editor? That kills the OLED. See [RGB Underglow](/docs/rgb).
- Try a settings_reset flash on both halves, then re-flash. See [Build & Flash](/docs/build-flash).
