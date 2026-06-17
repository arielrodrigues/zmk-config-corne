---
slug: anatomy
title: Keyboard Anatomy
group: Concepts
order: 10
---

# Keyboard Anatomy

A quick tour of what makes your Corne work, so the rest of the docs (RGB, OLED, keymap) make sense in context.

## A "split" keyboard

The Corne is a **split** keyboard — two physically separate halves you can place wherever your hands are comfortable. Each half is its own little computer (a [nice!nano v2](https://nicekeyboards.com/nice-nano), an nRF52840-based microcontroller).

```
   ┌─────────────────┐         ┌─────────────────┐
   │   LEFT HALF     │  ~~BT~~ │   RIGHT HALF    │
   │   (central)     │         │   (peripheral)  │
   └────────┬────────┘         └─────────────────┘
            │
       BT to your Mac
```

## Central vs peripheral

In this config, the **left half is the central**. That means:

- The left half talks to your computer over Bluetooth.
- The right half talks **only** to the left half over a separate BLE link.
- If you only see one half pairing with your Mac, that's expected — that's the left.

The right half won't show up to your computer at all. It just sends keystroke events to the left, which forwards them on.

## What lives where

Each half is flashed independently with its own firmware (`.uf2` file). The firmware is built from the source files in this repo:

| File | What it does | Lives on |
|---|---|---|
| `config/corne.keymap` | Defines what each key does, on each layer. | Both halves (same file, same firmware logic). |
| `config/corne.conf` | Settings: RGB defaults, OLED, BT, battery. | Left half (and parts of right). |
| `config/corne_right.conf` | Settings overrides for the right half. | Right half only. |
| `config/custom_status_screen.c` | The vampire OLED display code. | Left half only. |

The build process compiles all of this into three `.uf2` files:

- `build/corne_left/zephyr/zmk.uf2` — left half firmware
- `build/corne_right/zephyr/zmk.uf2` — right half firmware
- `build/settings_reset/zephyr/zmk.uf2` — special "wipe settings" firmware

## Why a settings_reset?

Some changes — especially Bluetooth pairings and big keymap structural changes — can leave stale state on the keyboard. When that happens, you flash `settings_reset.uf2` to *both* halves first to wipe the saved state, then flash the regular firmware. It's the keyboard equivalent of "have you tried turning it off and on again."

You don't need it for casual edits like changing the LED color. Use it when:

- Bluetooth refuses to re-pair.
- A half stops finding the other half.
- You just changed the keymap structure significantly (added/removed a layer).

## What you'll actually touch

Most of the time, only two of those files matter to you:

- **`corne.conf`** — controlled by the **RGB Underglow** and (parts of) **OLED** editors.
- **`corne.keymap`** — controlled by the **Keymap** editor.

The other files exist but rarely change.

## When it doubt: rebuild and flash both halves

After any edit, the safe move is:

1. Rebuild (from the **Build** sidebar entry).
2. Flash both halves.

Flashing one half but not the other can lead to subtle mismatches (e.g., RGB defaults set on the left but not effective until both reboot).
