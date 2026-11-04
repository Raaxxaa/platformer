# ART12: Mountain Rework Art (for M17) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Art for the Mountain road changes the user asked for (in the current style; a new overall art style comes later as its own plan once the user sends examples):
- the **Dragon's nest**: a cave on the summit with a wide opening to the sky, and its lived-in look (nest of branches, eggshells, bones, scorch marks, a glinting coin pile);
- the **cave labyrinth** inside the mountain: wall torches (animated), darker side tunnels, a few tunnel decorations (stalactites, crystals, old mining beams);
- a **bigger falling-rock warning**: a growing floor shadow and dust trickling from above.

**Spec:** `docs/spec/06-run-levels-save.md` §8.9 (labyrinth), §9.4 (the Mountain nest), §10 (`falling_rocks` warning); `08-art-audio.md` §8–§11 (objects, tiles, backgrounds, VFX), §12 (pipeline).

**Starting point:** ART11 on `main` (or current `main` if ART11 is still running; this plan is small). Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints
All earlier art constraints; never break `main`; only touch `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`.

## Tasks
### Task 1: Nest
- [ ] `objects`: `nest` (96 × 32, branches and straw), `eggshells` (24 × 12), `bones` (2 variants, 32 × 16), `coin_pile` (32 × 16, 2-frame glint at 2 fps), `scorch` (48 × 8 floor decal); a summit-cave backdrop for the side arena (`bg_mountains_nest`: rock walls, the sky through the opening) as a background variant the level can switch to inside the arena.
- [ ] **Look, commit.**

### Task 2: Labyrinth
- [ ] `objects`: `torch` (8 × 16, 3 frames at 8 fps, with a soft light the darkness system can use, 08 §10.2), `mine_beam` (16 × 48), `stalactite` (2 variants), `crystal_cluster` (2 colors, 2-frame shimmer). A darker variant of the cave background for side tunnels.
- [ ] **Look, commit.**

### Task 3: Falling-rock warning and hand-off
- [ ] `vfx`: `rock_shadow` (growing ellipse, 6 frames over 1.0 s), `dust_trickle` (8 × 32, 4 frames loop).
- [ ] **Board** `style_board_mountain_rework.png`: the nest with and without the Dragon, a labyrinth junction with torches, and the rock warning. **Show the user.** Push to `main`.
