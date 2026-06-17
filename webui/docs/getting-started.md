---
slug: getting-started
title: Getting Started
group: Start here
order: 0
---

# Getting Started

Welcome. This app lets you change how your Corne keyboard looks and behaves — RGB underglow colors, the OLED display, layer mappings, vampire frames — without hand-editing source files.

> **Who this is for.** You own this keyboard and you want to tweak it. You don't need to know what devicetree, Kconfig, or LVGL are. The app explains every setting it asks about.

## Launching the app

From the repo root:

```bash
cd webui
npm install     # only the first time
npm run dev
```

That starts two servers:

- **Frontend** at <http://localhost:5173> — what you see in your browser.
- **Backend** at `http://127.0.0.1:5174` — reads and writes your config files.

Open <http://localhost:5173> in your browser.

## The change loop

Every change follows the same four steps:

1. **Edit** — pick an editor from the sidebar (e.g. RGB Underglow), change a setting.
2. **Save** — press Save. A diff preview pops up showing exactly what will change in the config file.
3. **Confirm** — review the diff and confirm. The file is written to disk.
4. **Rebuild & flash** — head to the **Build** section. Press **Rebuild firmware**. When it's done, copy the two `.uf2` files to each half of the keyboard (instructions there).

Changes don't take effect on the keyboard until you rebuild and flash. The app never touches the keyboard directly.

## Where to start

- **[RGB Underglow](/rgb)** — easiest tweak. Change the color or brightness without ever editing a file.
- **[OLED Display](/oled)** — change the idle "love you!" message, the inactivity timeout, and the vampire animation thresholds.
- **[Keymap](/keymap)** — see all four layers and what each key does. Click a key to remap it.

## What this app doesn't do

- It doesn't flash the firmware for you — you still need to physically copy the `.uf2` files to each half.
- It doesn't replace **ZMK Studio** for fast keymap changes. Studio is the official tool for live keymap edits over USB. This app is for everything Studio doesn't cover. See [Studio vs this app](/docs/studio) once that doc is added.
- It doesn't change anything outside `config/` in this repository.

## Trouble?

Check **Docs → Troubleshooting** (coming with Phase 6) or read [CLAUDE.md](https://github.com/arielrodrigues/zmk-config-corne/blob/master/CLAUDE.md) at the repo root for the developer-oriented version of these notes.
