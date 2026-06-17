---
slug: rgb
title: RGB Underglow
group: Editors
order: 30
---

# RGB Underglow

The Corne has **WS2812 RGB LEDs** mounted under each switch — one tiny full-color LED per key. Together they're called the "underglow." This page explains the editor and the gotchas.

## What each setting does

### Effect

Picks the animation style.

| Effect | What it looks like | Battery cost |
|---|---|---|
| **Solid** | One steady color. No animation. | **Lowest.** Best choice if you want LEDs on for a long session. |
| **Breathe** | The color pulses brighter and dimmer. | Higher — the MCU and LED bus stay active continuously. |
| **Spectrum** | All LEDs cycle the full rainbow together. | Higher. |
| **Swirl** | The rainbow flows around the chain. | Higher. |

If battery life matters, **Solid** is always the right choice. Animations look pretty but they keep the MCU busy.

### Hue / Saturation / Brightness

These are HSV (or HSB) — the same color model as picker tools in most design apps.

- **Hue** is a position on the color wheel: 0 = red, 60 = yellow, 120 = green, 240 = blue, 300 = magenta. Wraps around at 360 back to red.
- **Saturation** is "how colorful" — 0 = white/gray, 100 = pure color.
- **Brightness** is "how bright" — 0 = off, 100 = max.

Battery drain is roughly linear with brightness. A brightness of 20 draws about ¼ the current of a brightness of 80, with very little visual difference indoors. **Going from 80 → 20 is the single biggest battery win you can make** without turning the LEDs off.

> **Important:** Hue and Saturation only affect **Solid** and **Breathe**. Spectrum and Swirl cycle their own colors and ignore these.

### Animation speed

1 (slowest) to 5 (fastest). Ignored for Solid since there's nothing to animate.

### LED driver enabled

Off = the LED driver doesn't initialize at all. The LEDs go dark.

**Don't use this for "off" if you can help it.** When the driver isn't loaded, the data line to the first LED is left floating, and electrical noise can latch random bits into the first few LEDs of the chain — you'll see "ghost LEDs" stuck on random colors. Use **Brightness = 0** or **Start LEDs on at boot = off** instead. (See [Troubleshooting](/docs/troubleshooting) once that doc is added.)

### Start LEDs on at boot

When the keyboard powers up, should the LEDs be on?

- If on: LEDs come up with whatever Effect + color you chose.
- If off: LEDs come up dark. The driver is still active, so the keyboard sends "off" to every LED — no ghost LEDs. You can flip them on later with the **H** key on the Adj layer.

### Allow LED toggle to cut peripheral power

**Leave this OFF.** This is the most important warning on the page.

The nice!nano v2 has a single power switch (called `EXT_POWER`) that gates the 3.3 V rail shared by both the LEDs **and** the OLED display. The Corne shield doesn't add a separate switch just for the LEDs.

If you turn this setting on, ZMK's default behavior is: when you press the LED-toggle key, it cuts that whole rail to save power. **That also cuts power to the OLED**, which goes blank until the LEDs come back on. Confusing if you forget about it.

With this off, the LED-toggle key just sends "off" pixels to the LEDs while leaving the rail alive. Tiny extra standby draw (~1 mA per LED chip), but the OLED stays lit.

### Brightness step

Under **Advanced.** When you press the brightness up/down keys on the Adj layer (K and L), this is how much each press changes brightness. Default is 10.

If your starting brightness is small (say, 5), and the step is 10, pressing **brightness down** once will clamp to 0 — looks like LEDs jumped straight to off. Set a smaller step (e.g., 2 or 5) if you want finer control.

## The runtime Adj-layer controls

The current keymap puts four LED controls on the right home row of the **Adj** layer (hold both thumb layer keys — NAV and SYM — to get there):

| Key | Effect |
|---|---|
| **H** | Toggle LEDs on/off |
| **J** | Cycle through effects |
| **K** | Brightness − |
| **L** | Brightness + |

These changes don't persist across restarts. To make a setting permanent, change it here and rebuild.

## A reasonable battery-saver preset

If you like the LEDs but you're tired of charging:

- **Effect:** Solid
- **Hue:** any (it's whatever color you like)
- **Saturation:** 100
- **Brightness:** 5–10
- **Speed:** doesn't matter
- **LED driver enabled:** on
- **Start LEDs on at boot:** on
- **Allow LED toggle to cut peripheral power:** off

This is the current config in this repo.
