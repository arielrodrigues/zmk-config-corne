---
slug: combos
title: Combos
group: Concepts
order: 50
---

# Combos

A **combo** fires a binding when you press **two or more specific keys at the same time**, within a short window (the timeout, usually 50 ms). The combo replaces whatever those keys would individually have done.

If you don't press them simultaneously enough, nothing combo-like happens — the keys fire their normal bindings.

## The three combos in this config

You can see all of these listed (with hover-highlight of the involved keys) in the [Keymap viewer](/keymap).

### Bootloader — left half

Press the **top-left** and **bottom-left** outermost keys together → puts the **left half** into bootloader mode. The left half then mounts as a USB drive, and you can drop a UF2 onto it.

Positions: **0 + 24**.

This is the easy way to flash the left half without finding the reset button. It works on any layer.

### Bootloader — right half

Symmetric: **top-right** and **bottom-right** outermost keys → puts the **right half** into bootloader mode.

Positions: **11 + 35**.

The right half needs its own bootloader trip when you want to flash it; this combo saves you from looking for the tiny reset button. Works on any layer.

### Studio unlock

Press **both thumb-inner keys** (NAV + SYM) at the same time → fires `&studio_unlock`, which authorizes [ZMK Studio](https://zmk.dev/docs/features/studio) to apply keymap changes. Without this combo, Studio refuses to edit the keymap, even when plugged in.

Positions: **38 + 39**. Only fires on the Base layer.

## Tweaking combos

Combo definitions live in `corne.keymap` under the `combos {` block. Each combo has:

- `timeout-ms` — how strict the simultaneity check is. Lower = harder to trigger by accident. Default 50 ms.
- `key-positions` — the positions that must be pressed together. See the position numbers in the [Keymap viewer](/keymap) — they're the small numbers in each key's corner.
- `bindings` — what to fire when the combo triggers. Same syntax as the regular keymap.
- `layers` — optional. If specified, the combo only works while those layers are active.

To add a new combo, copy an existing one and edit the four fields. A visual combo editor isn't in the current build plan — speak up if you'd like one.

## Why both bootloader combos are on outermost keys

If you accidentally trigger the bootloader by typing, you'll be very sad. Putting the combo on the **outermost top and bottom keys** of one half makes that essentially impossible during normal typing — you'd have to deliberately reach for both corners at once.
