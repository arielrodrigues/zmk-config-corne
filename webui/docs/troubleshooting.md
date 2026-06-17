---
slug: troubleshooting
title: Troubleshooting
group: Workflow
order: 80
---

# Troubleshooting

Common issues and how to fix them, grouped by symptom. Most fixes come down to: **rebuild, flash, sometimes settings_reset**.

## The keyboard

### A key is dead — pressing it does nothing

- **Wrong layer?** Use the [Keymap viewer](/keymap) to check what's bound at that position on each layer. The key might be `&trans` or `&none` on the layer you're currently on.
- **Wrong half not flashed?** If a whole side stopped working, the firmware on that half may be out of date. Rebuild and flash both halves.
- **Switch is physically broken?** Try the same key location after pulling out and reseating the switch (with the keyboard powered off). If it still doesn't work and *only that switch* is affected, you may have a bad switch or a cold solder joint.

### Both halves stopped talking to each other

- Flash **`build/settings_reset/zephyr/zmk.uf2`** to **both** halves. This wipes the saved Bluetooth pairing between them. Then re-flash the regular `corne_left.uf2` and `corne_right.uf2`. They'll automatically re-pair.

### Bluetooth refuses to pair with your computer

- Flash `settings_reset.uf2` to both halves, then re-flash. Re-pair from your computer's BT settings.
- Make sure you're connecting to the **left half** — the right half isn't visible to the computer.
- If you have multiple BT profiles, switch to a different one (`Adj` layer, BT 0–4) and re-pair there.

### Battery dies fast

The biggest savings, in order of impact:

1. **RGB brightness** is the main draw. Drop it from 80 → 20 in the [RGB editor](/rgb) and you'll easily double battery life. Or go to 5–10 for the dimmest visible glow.
2. **Use Solid effect** instead of Breathe/Spectrum/Swirl. Animations keep the MCU busy.
3. **Lower BT TX power** (currently `CONFIG_BT_CTLR_TX_PWR_PLUS_8=y` in `corne.conf`) if you don't need the range — but this is rarely the actual problem.

The OLED uses very little power compared to LEDs.

## The OLED display

### OLED is blank but the keyboard still works

- You probably pressed the LED-toggle (Adj layer **H**) with **Allow LED toggle to cut peripheral power** enabled in the [RGB editor](/rgb). That setting kills the OLED along with the LEDs. Turn it back off and rebuild.
- The `&ext_power EP_OFF` binding (top-right of the Adj layer) also kills the OLED — it cuts the entire 3.3V rail. Press `&ext_power EP_ON` to bring it back.

### OLED has white-pixel trails or noise

A bug in the screen code: never set `lv_obj_set_style_bg_color(screen, lv_color_black(), ...)` and never move labels at runtime — both cause white pixel artifacts because the display is hardware-inverted. See [OLED Display](/docs/oled) for the underlying explanation.

### OLED shows the wrong layer icon

- Make sure the **left half** was the one that got the new firmware. Right-half firmware doesn't have the custom screen.

### Love message never appears

- Idle timeout might be set very high. Check the [OLED editor](/oled) and lower it.
- Set it to **0** if you've turned it off in the past — but the layout assumes `> 0` so leave it at least at a few seconds.

## The LEDs

### A few LEDs are stuck on a random color, the rest are off

You turned the underglow driver off via Kconfig. The data line floats and noise gets latched into the first few LEDs of the chain. Fix:

- In the [RGB editor](/rgb), turn **LED driver enabled** back on.
- Turn **Start LEDs on at boot** off if you don't want the lights at boot. The driver will actively clock zeros down the chain → all LEDs reliably off, no ghosts.

### LEDs blink/flicker briefly when toggling

Expected with animations. The driver wakes up the LED bus on every refresh tick. Switch to Solid for a steady image.

### Pressing the LED-toggle kills the OLED

See **OLED is blank** above.

### LEDs are too bright when I rebuild

Default brightness in this config is 5%. If you bumped it without realizing, set it back in the [RGB editor](/rgb).

## The build

### `./rebuild` fails immediately

Usually one of:

- **Virtual environment not at `~/zmk-venv`** — the script activates that path. Either set it up there or edit `rebuild` to point at your venv.
- **Zephyr SDK missing or wrong version** — needs `~/zephyr-sdk-0.17.0`. See the repo's `CLAUDE.md` for the original toolchain install instructions.
- **`west` not installed** — `pip install west` inside the venv.

### Build fails halfway with "undefined reference" or similar

A code-level error. Look at the failed line in the streamed log on the [Build](/build) page. Recent edits to `custom_status_screen.c` are the usual culprit since it's hand-written C.

### Build hangs or runs forever

Press **Cancel** on the [Build](/build) page (SIGTERMs the child). Then run it again. If it consistently hangs at the same step, the cmake cache may be stale — delete `build/` from the repo root and try again.

### Flashing — the half isn't appearing as a USB drive

- Make sure you **double-tapped reset**, not single-tapped. The first tap resets; the second within ~½ sec enters bootloader.
- USB cable is the next suspect. Some USB cables are power-only and don't carry data. Try another cable.
- The nice!nano enters bootloader for ~10 seconds before going back to firmware. If you miss the window, double-tap again.

## ZMK Studio

### Studio says "locked"

You need to fire the `&studio_unlock` combo:

- Make sure you're on the **Base** layer (not holding any layer keys).
- Press the **two inner thumb keys** (NAV + SYM positions, 38 + 39) **simultaneously** within 50ms. If it doesn't trigger, you're not pressing them simultaneously enough — practice.

### Studio changes vanished after a rebuild

That's how it works. Studio writes to the keyboard's flash, not to `corne.keymap`. A rebuild re-flashes from source and overwrites Studio's changes. See [Studio vs this app](/docs/studio).

To persist a Studio change: replicate it in this app's [Keymap editor](/keymap), then rebuild.

## This app

### The page is blank or won't load

- Run `npm install` again from `webui/`.
- Are both servers running? `npm run dev` should print logs for both `[FE]` and `[BE]`. If only one is up, the API calls will fail.
- The backend checks for `config/corne.keymap` on boot and refuses to start otherwise. Make sure you're running from inside the repo.

### "Failed to load" errors in the sidebar

The backend isn't reachable. Check the terminal where you ran `npm run dev` — there should be backend errors. Common cause: a previous backend process is still holding port 5174. `pkill -f tsx` to clean up.

### My edits don't take effect

Edits change files in `config/`, but the keyboard doesn't see them until you:

1. **Rebuild** (Build → Rebuild firmware).
2. **Flash** both halves (drag the new `.uf2` files onto the bootloader-mode drives).

There's no shortcut — the firmware has to be rebuilt for any config change to apply.

## Still stuck?

- Read `CLAUDE.md` at the repo root for developer-level notes.
- Open an issue on [the GitHub repo](https://github.com/arielrodrigues/zmk-config-corne) with the build log if it's a build failure, or a description of what happens vs. what you expected if it's behavioral.
