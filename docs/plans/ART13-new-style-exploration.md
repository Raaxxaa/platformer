# ART13: New Art Style — Part 1, Style Exploration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user wants a new art style but has no reference pictures yet. Instead of guessing, draw **the same test scene in 4 different styles** so the user can point at one. Nothing in the game changes in Part 1; only test images are made. Part 2 (redrawing the game in the chosen style) gets its own plan after the user picks.

**The test scene** (the same in every style, 640 × 360 shown at 2×): a piece of Stage 1 Plains (grass ground, a one-way platform, a slope, background hills and sky), the hero (human, leather outfit) mid-jump swinging the Greatsword, a Wolf leaping at them, a Bandit Archer on a ledge, a Lucky Block, a key chest, the HUD (health bar, flask, weapon and ability bar top-right), and one hit spark.

## The 4 styles

| # | Name | What it means | Notes for drawing |
|---|---|---|---|
| A | **HD pixel art** | Still pixel art, but twice the detail: the hero about 64 px tall instead of 32, richer shading, soft light and glow effects. Like Dead Cells or Owlboy | Draw at 2× the current pixel density (game resolution stays 640 × 360, sprites get 4× the pixels); smooth animation-friendly shading, rim light |
| B | **Dark and moody** | Current pixel size, but a darker palette with strong lights: glowing eyes, lit torches, fog layers, deep shadows. Like Blasphemous | Limited dark palette, bright accent colors only for light sources and danger; fog gradient layers |
| C | **Bright cartoon** | Not pixelated: smooth shapes, thick dark outlines, bold flat colors with one shade. Like a mobile cartoon game or Rayman | Vector-style drawing rendered at full resolution (smooth edges); the game would switch off pixel scaling for this style |
| D | **Painted storybook** | Soft painted look: textured brush shading, warm light, gentle outlines. Like Hollow Knight's backgrounds or a picture book | Brush-texture shading made procedurally (noise and gradients) on smooth shapes; characters stay readable with a darker outline |

## Global Constraints
- Only touch `tools/`, `docs/art/` (and `tools/out/preview/`). **No game files change** (`public/assets/` stays as it is).
- Every option must keep the gameplay readable: the hero and enemies stand out from the background, and the Wolf's attack telegraph (the orange flash) is visible. Run the contrast check on each option and show the result.
- Be honest about cost: for each option, write one line on how much work redrawing the whole game would be (all sprites, tiles, backgrounds, effects, UI) and anything it would change in the code (for C and D: smooth scaling instead of pixel scaling).

## Tasks
### Task 1: The 4 test scenes
- [ ] `tools/art/style_test.py` draws the scene in styles A–D: `docs/art/style_test_A.png` … `_D.png`, plus a close-up of the hero and the Wolf at 4× for each (`style_test_A_closeup.png` …).
- [ ] **Look at every image** with the Read tool. Make each option as good as it can be in its own style, not a quick filter over the current art.
- [ ] **Commit and push to `main`** (only `tools/` and `docs/art/`).

### Task 2: Show the user
- [ ] Send the user the 4 scenes and close-ups, side by side, with one plain sentence each on what's different and the cost line. Ask:
  - Which one do you like most? (Or: which parts of which, e.g. "A's characters with B's lighting"?)
  - Anything you don't like in your favorite?
  - Should it work on phones as well as on the computer? (It must; just confirm nothing looks too small.)
- [ ] Write the answer in `docs/art/style_choice.md`. The design chat then writes ART13 Part 2 (the full redraw plan) and the spec changes.

## Done when
The user has picked a style (or a mix), and the choice is written down.
