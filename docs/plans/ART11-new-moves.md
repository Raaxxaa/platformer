# ART11: Art for the New Moves and Modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poses and swing streaks for the three new moves of every weapon (02 §9.6a): the **Launcher**, the **up air attack** and the **Rushing Strike** (dash attack); ranged weapons' **straight-up shot** poses; a **juggle** hit effect; and title icons for **Daily** and **Boss Rush**.

**Note:** the user wants a **new art style** and will send examples. This plan only adds frames in the **current** style, so the new moves look right now; a style change will be its own plan and will redraw these too.

**Spec:** `docs/spec/02-combat.md` §9.6a (boxes and timings: each streak should cover its box like the combo streaks, with the same accepted lower cover for short weapons); `08-art-audio.md` §6.2–6.3 (key and frame rules: 5 frames `[S0, S1, A, R0, R1]`), §12.4 (smears); 09 §7 (the layered player: new poses go into **every** layer atlas).

**Starting point:** ART10 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints
- All earlier art constraints; never break `main`; only touch `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`.
- New keys per melee weapon: `atk_<weaponId>_up`, `atk_<weaponId>_upair`, `atk_<weaponId>_dash` (5 frames each, body poses in every player layer atlas, weapon frames and `_smear` in `weapon_<id>`). Ranged weapons: `atk_<weaponId>_upshot` (5 frames, release on frame 2). The Spear, Shield and the Katana charge keep their existing dash moves; the Katana gets `atk_katana_dash` for its tap Rushing Strike.

## Tasks
### Task 1: Body poses (shared by weight)
- [ ] Launcher, up air and Rushing Strike poses for light, medium and heavy weapons (a rising swing from low to overhead; an overhead arc in the air; a lunging horizontal strike), plus an up-shot pose for bows/crossbows, cannons, throws and staffs/wands. In every layer atlas of 09 §7. Feet row 45. **Look, commit.**

### Task 2: Weapon frames and streaks for all 19 weapons
- [ ] Each melee weapon's three new keys with smears covering the 02 §9.6a boxes; each ranged weapon's up shot. Tests hold each streak at the accepted cover floors (art notes 4, 6, 17). **Look, commit.**

### Task 3: Effects and icons
- [ ] `juggle_spark` (24 × 24, 4 at 30 fps: an upward star burst) and `launch_dust` (32 × 12, 4 at 20 fps) in `vfx`.
- [ ] `ui` icons `icon_mode_daily` (a sun over a calendar page) and `icon_mode_bossrush` (crossed swords over a skull), 16 × 16.
- [ ] Sounds: `launch` (rising whoosh + thud), `juggle_hit` (`hit_medium` pitched up a step per juggle: the game passes the count), `dash_strike` (sharp swish).
- [ ] **Board** `tools/out/preview/style_board_moves.png`: one row per weight with the three moves on a Wolf, plus the up shots. **Show the user.** Push to `main`.
