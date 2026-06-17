---
slug: build-flash
title: Build & Flash
group: Workflow
order: 60
---

# Build & Flash

Every change you make in this app is just an edit to a file in `config/`. The keyboard doesn't see your change until you **rebuild the firmware** and **flash** it onto each half.

## Rebuild

In the sidebar, click **Build → Rebuild & KLE**, then **Rebuild firmware**.

The app runs the repo's `./rebuild` script and streams its output to your browser. The build takes 3–6 minutes. You'll see lines like:

```
==> Building left half...
==> Building right half...
==> Building settings reset...
Done.
```

When it finishes, the app shows three file paths:

| File | Use it for |
|---|---|
| `build/corne_left/zephyr/zmk.uf2` | Left half firmware. |
| `build/corne_right/zephyr/zmk.uf2` | Right half firmware. |
| `build/settings_reset/zephyr/zmk.uf2` | Wiping saved settings. Usually skip this. |

## Flashing

Each half is its own little USB drive when in bootloader mode. To flash:

1. **Plug the half into your computer** via USB-C.
2. **Tap the reset button twice** quickly. The half mounts as a drive called `NICENANO` (or similar).
3. **Drag and drop** the appropriate `.uf2` file onto the drive. The drive disconnects and the half reboots with the new firmware.
4. Repeat for the other half.

> If you're not sure which half is left and which is right: the **left half** is the one with the OLED display showing the vampire animation.

## When to use `settings_reset.uf2`

Flash settings_reset.uf2 to **both halves** when:

- Bluetooth refuses to pair, or pairs to the wrong device.
- One half can't see the other.
- You just made a structural keymap change (added a layer, changed combos).

After flashing settings_reset to both halves, re-flash the regular `corne_left.uf2` and `corne_right.uf2`. You'll need to re-pair Bluetooth.

You do **not** need this for routine changes like RGB color tweaks.

## Cancelling a build

You can press **Cancel** while a build is running. The app sends `SIGTERM` to the build process, which usually stops within a few seconds. The build directory may be left in a partial state — the next build will start over (the `./rebuild` script always builds `--pristine`, so this is fine).

## Generate KLE

The other button on this page, **Generate KLE**, runs the repo's `./generate-kle` script. It reads `config/corne.keymap` and prints a config you can paste into [keyboard-layout-editor.com](https://www.keyboard-layout-editor.com) to visualize the layout. Useful for sanity-checking the keymap, sharing with people, or making a printable cheat-sheet.

After the script finishes, press **Copy to clipboard** and paste the result into the **Raw data** tab on the KLE site.

## What if the build fails?

Common causes:

- **Wrong working directory** — the backend must launch from inside this repo. It checks for `config/corne.keymap` on startup and refuses to start otherwise.
- **Python venv not activated** — `./rebuild` expects `~/zmk-venv` to exist (it activates it itself). If you have a different venv path, edit the `rebuild` script.
- **Zephyr SDK missing** — needs `~/zephyr-sdk-0.17.0`. See the repo's `CLAUDE.md` for the full toolchain setup.
- **Out of date submodules** — try `west update` from the repo root.

The streamed output usually contains a useful error line — scroll up in the log area.
