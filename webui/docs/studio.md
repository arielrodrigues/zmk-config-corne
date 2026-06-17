---
slug: studio
title: ZMK Studio vs this app
group: Workflow
order: 70
---

# ZMK Studio vs this app

[ZMK Studio](https://zmk.dev/docs/features/studio) is the official ZMK GUI for editing the keymap **live over USB**, without rebuilding firmware. This config has it enabled on the left half — the firmware exposes a USB RPC channel that Studio talks to.

This app and Studio overlap in one place — keymap editing — and complement each other elsewhere. Here's when to use which.

## Use ZMK Studio when…

You want to **change which keys do what, quickly, without rebuilding**.

Workflow:

1. Plug the **left half** into your computer via USB.
2. Open the [ZMK Studio web app](https://zmk.studio).
3. Press **NAV + SYM** together (the inner thumb-keys) — this fires the `&studio_unlock` combo and authorizes Studio to edit your keymap.
4. Drag bindings around in Studio's UI.
5. Save. Studio writes the changes directly to the keyboard's flash storage. No rebuild needed; no reflash needed; changes take effect immediately.

## Use this app when…

- You're editing **RGB settings**, **OLED display**, or **vampire frames** — Studio doesn't touch any of those.
- You want a **visual map of the entire keymap across all four layers** without plugging in.
- You want to **rebuild and flash** the firmware end-to-end.
- You want to **read the docs** about how everything works.
- You want to make a **set of keymap changes** that you'll commit to git — see the warning below.

## ⚠️ The big gotcha: Studio writes to flash, not to corne.keymap

This is the one thing to remember:

> **Studio changes do not modify `corne.keymap`.** They live only in the keyboard's flash storage.

That means:

- If you flash a fresh firmware (e.g. after `./rebuild`), **your Studio changes are wiped** — the firmware uses whatever is in `corne.keymap`. To keep them, you'd have to re-apply them in Studio after each flash.
- If you use this app's keymap editor (in Phase 5b) **and** Studio, the two sources can diverge. The next `./rebuild` will overwrite whatever Studio did with the contents of `corne.keymap`.

In practice, the two tools serve different goals:

| Goal | Tool |
|---|---|
| "Let me try a binding for the next 10 minutes." | **Studio** — fast, no commitment. |
| "I want this in git so I can roll back later." | **This app's keymap editor** (or hand-edit `corne.keymap`). |

If you make a Studio change you like, the easiest way to persist it is to make the same edit in this app and rebuild.

## Unlocking Studio

For safety, Studio refuses to make any changes until the keyboard explicitly says "I'm OK with this." That signal is the `&studio_unlock` binding, which this config triggers via the **NAV + SYM combo** (both inner thumb keys at once).

If Studio shows "locked" after you connect:

- Make sure you're on the **Base** layer when you press the combo — the unlock combo is layer-restricted to Base.
- The combo timeout is 50 ms — both keys must register within that window. Try again.

## Studio doesn't see RGB or OLED

Studio is a **keymap** editor. It can't change LED color, vampire frames, OLED text, or any Kconfig setting. Use this app's RGB and OLED editors for those.
