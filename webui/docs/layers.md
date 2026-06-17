---
slug: layers
title: Layers Explained
group: Concepts
order: 20
---

# Layers Explained

A **layer** is a complete alternate set of bindings for every key on the keyboard. You switch between layers by holding a special "layer key" — while it's held, the keyboard uses that layer's bindings instead of the default ones.

This config has **four** layers:

| Index | Name | What it's for | How to activate |
|---|---|---|---|
| 0 | Base | QWERTY typing | Default — always active when nothing is held. |
| 1 | Nav  | Numbers, arrows, F-keys | Hold the **NAV** key (innermost left thumb). |
| 2 | Sym  | Symbols, media keys | Hold the **SYM** key (innermost right thumb). |
| 3 | Adj  | Bluetooth, RGB, power, reset | Hold **NAV + SYM** at the same time. |

## How layer keys work

In ZMK, a binding like `&mo NAV_L` means "while held, activate the NAV layer." The moment you release the key, the layer deactivates and you're back to Base.

Two examples from the current keymap:

- The right thumb-inner key on Base is `&mo SYM_L` — hold it to access the Sym layer (symbols, brackets, media keys).
- On the Nav and Sym layers, the left/right thumb-inner key is `&mo ADJ_L` — so holding *both* gets you the Adj layer.

This is a *momentary* layer activation. There's also "toggle" (`&tog`), "to" (`&to`), and tap-dance variants — none of those are used here.

## Reading the Keymap viewer

In the [Keymap viewer](/keymap), each layer is a tab. The keys are drawn in their physical layout — left half on the left, right half on the right, three thumb keys per side at the bottom.

Each cell shows:

- **Big label:** what the key does on the current layer (e.g., `Q`, `Shift`, `BT 0`).
- **Tiny number in the corner:** the position index in the binding array — useful when reading the raw `corne.keymap` source.

### Special symbols

| Symbol | Meaning |
|---|---|
| `▽` | `&trans` — "transparent." The key falls through to whichever layer below has a binding. |
| `·` | `&none` — does nothing. |
| `MO ADJ` | Layer key (`&mo`). Tap does nothing; hold activates that layer. |

## A real example: pressing `J` on different layers

On Base, position 19 is `J`. Watch what happens on the others (use the viewer to see for yourself):

- **Base:** types `J`.
- **Nav:** moves the cursor **down** (it's bound to `&kp DOWN`).
- **Sym:** also `&kp DOWN`.
- **Adj:** cycles RGB effects (`&rgb_ug RGB_EFF`).

That's the power of layers — the same physical key serves four different functions depending on what your thumbs are doing.

## Want to change a binding?

For now, edit `config/corne.keymap` by hand, or use **ZMK Studio** for fast live edits (see [Studio vs this app](/docs/studio) once that doc is added). A click-to-edit binding picker is coming in Phase 5b.

> **Why ZMK Studio for keymaps?** Devicetree (the file format `corne.keymap` uses) is hand-edited and dense with comments and custom blocks. Round-tripping it through a UI risks losing those. Studio talks directly to the keyboard's firmware to apply keymap changes without ever touching the source file.
