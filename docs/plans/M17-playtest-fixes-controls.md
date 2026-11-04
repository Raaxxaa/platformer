# M17: Playtest Fixes, Rebinding and a Movable HUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what the user found while playing, and let players set up controls and the HUD their way:
1. **Bow and other shots miss Wolves** (they flew over low enemies).
2. **The Mountain climb is too hard:** slower falling rocks with a bigger warning and more time between them, and **no flying enemies** on the climb.
3. **The Dragon's room on the Mountain road** becomes a **nest in a cave on the summit**, lived-in even without the Dragon.
4. **The minecart is removed**; that part becomes a **cave labyrinth** inside the mountain (the nest can't be reached from it).
5. **Key rebinding screen** (designed in 07 §7.8, never built).
6. **Movable HUD:** weapons and abilities move to the **top-right** by default, the timer to the bottom-right (top-center on phones), and a **layout editor** to move every HUD group (health/flask, weapons/abilities, timer).

**Spec:**
- `docs/spec/02-combat.md` §9.8 (shots spawn at `+12, −10`) and §10.4 (arrow, charged arrow, bolt and knife boxes 6 px tall).
- `docs/spec/06-run-levels-save.md` §10 (`falling_rocks`: 3.0 s apart, 1.0 s warning, 240 px/s), §8.3 (`mountains`: no flyers in §3, nest, labyrinth, no minecart), §8.9 (the labyrinth), §9.4 (the Mountain nest).
- `docs/spec/07-ui-hud-controls.md` §4.1a (HUD groups, new defaults, editor), §7.8 (rebinding), §8.3 (rebinding rules), §8.6 (the touch layout editor, already built: make sure it's reachable from Pause on phones).

**Starting point:** current `main` (do it after M16 if M16 isn't done). Merge `main` and `origin/claude/great-dijkstra-g00pcj` first. ART12 draws the nest, labyrinth details and the bigger rock warning; use simple shapes until then.

## Global Constraints
- All earlier constraints hold. The mountain changes redraw **all three versions** of Mountains §6 (06 §8.7) and change §3's enemies in all three versions; every combination must still validate (counts, per-type mix, movement limits, max size).
- Old saves load with the new HUD defaults (no `settings.hud` yet = defaults).

## Review Focus
1. **Every enemy can be shot:** a tap shot from the ground hits every enemy type standing on the same floor, point blank and at 100 px (one test per enemy id).
2. **Labyrinth fairness:** the main route is always marked; no blind drops onto enemies; the nest is sealed from the caves.
3. **Rebinding can't lock a player out:** 07 §8.3 rules (every action keeps a key, swaps on conflict).

---

### Task 1: Shots that hit low enemies
- [ ] **Tests first:** for every enemy in `src/data/enemies.ts` (Wolf, Spiderling, Giant Spider, Wild Boar, Bat Swarm on the ground, humanoids, elites, bosses), a Bow tap arrow, a Crossbow bolt, Throwing Knives and a Staff bolt fired from the same floor hit it at 24 px and at 100 px.
- [ ] Spawn point `+12, −10` and the 6 px boxes (02 §9.8, §10.4). Check the Eagle Eye, Arcane Archer and Warden tests still pass. **Commit.**

### Task 2: Easier falling rocks, no flyers on the climb
- [ ] `falling_rocks`: first drop 0.6 s after entering, then every 3.0 s; the floor warning lasts 1.0 s and grows (shadow from 25% to 100% width) with dust trickling from above; rocks fall at 240 px/s (06 §10). Boss rockfalls unchanged. Tests for the timings and speed.
- [ ] Mountains §3 (all versions): its 2 regulars become **Rams on flat ground** at the bottom and the top of the climb; the bats that were there move to §2 or §6 so the per-type mix (05 §9.5) stays exact. `validateLevel` and the per-version content checks pass. **Commit.**

### Task 3: The Dragon's nest and the cave labyrinth
- [ ] Write the new design in `docs/levels/mountains.md` first: the summit nest (a cave with a wide opening to the sky, entered from the peak path) and the labyrinth for each of the 3 versions of §6 (3 routes, ≥ 2 complete, dead-end nooks with Lucky Block #3 and Key #2, the merchant hall, torches and guide arrows on the main route).
- [ ] Rebuild Mountains §6 v1, v2, v3 without the minecart. The side arena keeps 06 §9.4's size and platform, with the nest decoration objects (`nest`, `bones`, `eggshells`, `coin_pile`, `scorch`; drawn by ART12, simple shapes until then). Seal it from the caves (≥ 3 tiles of rock).
- [ ] The minecart code stays (01 §13.6) but no level uses it; remove its sounds from the mountain music/ambience triggers if any.
- [ ] **Checks:** all 243 combinations validate; a route bot finishes the main route of each version; screenshots of the nest (with and without the Dragon) and of every labyrinth version. **Read them. Commit.**

### Task 4: Key rebinding
- [ ] The Controls screen of 07 §7.8 (keyboard and gamepad columns, capture, cancel, clear, reset) with the 07 §8.3 rules, from Settings and from Pause → Settings. On phones, Settings → Touch → **Edit layout** (M12) is reachable from Pause too.
- [ ] **Tests:** the 07 §8.3 rules (swap on conflict, every action keeps a keyboard key, fixed cells), bindings apply at once, saved and restored. E2E: rebind Jump to K and jump with it. **Commit.**

### Task 5: HUD groups and the layout editor
- [ ] Draw the HUD as the three groups of 07 §4.1a at their positions (`settings.hud` or the device's defaults): `slots` top-right, `timer` bottom-right (top-center with the touch overlay, alerts moved to y 44/62), toasts bottom-left.
- [ ] The **HUD layout** editor (Settings and Pause → Settings): pick a group, presets, 4 px nudges or drag, Reset, overlap check, safe area, the boss-bar zone.
- [ ] **Tests:** defaults per device; a moved group keeps its inner layout; overlap refused; saved and restored. **Screenshots** of the new default HUD on desktop and phone, and of the editor. **Read them. Commit.**

### Task 6: Hand-off
- [ ] Run everything; push to `main`.
- [ ] Tell the user, with screenshots: the bow now hits wolves; the mountain climb has slower rocks with a bigger warning and no bats; the Dragon now lives in a nest on the summit; the minecart is gone and there's a cave labyrinth instead; keys can be rebound; the weapon and ability bar is top-right and every HUD part can be moved. Ask: is the climb fair now? Is the labyrinth fun or confusing?
