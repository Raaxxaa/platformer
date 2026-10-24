# M11: Layouts That Change Every Run — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Like Dead Cells, every run's stages are a little different. Sections 2, 3, 4, 6 and 7 of each stage get **3 hand-made versions**; the run's seed picks one per section. The start, the combat arena and the boss arena stay fixed. Same seed = same layout, so seeded races and practice still work.

**Rules:** `docs/spec/06-run-levels-save.md` **§8.7** (new). Also 06 §7.2 (streams), §8.2–8.5 (template, counts, sizes, movement limits), §9.5 (timed doors), §13 (level format), §14 (practice), §15 (save: history gets the layout code); `docs/GAME_PLAN.md` §14.1.

**Two parts:**
- **Part A** (Tasks 1–6): the variant system end to end, proven on **Plains** (Stage 1).
- **Part B** (Tasks 7–8): versions for **mountains, swamps, kingdom and castle**, one stage per task.

**Starting point:** M10 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints

- All earlier constraints hold. Level files are generated; the same source gives byte-identical output.
- **`v1` of every section is today's layout, unchanged.** The classic assembly (all `v1`) must give a level identical in tiles and objects (ids may be renumbered only if every test still passes) to today's `public/levels/<id>.json`. Existing tests keep passing.
- **Every version keeps the exact contents of its section** (06 §8.7). A test checks this for every version, so any combination keeps 06 §8.2/§8.4 counts.
- **Every combination is validated:** all 243 per stage pass `validateLevel` and `routeLint` (06 §8.5 movement limits on the main path). Run in Vitest; if it's slow, cache per-version results and check only the joins and totals per combination.
- The core stays pure: assembly is a pure function `assembleLevel(pack, picks) → LevelData`, no Phaser.

## Review Focus

1. **Bad joins:** a version that doesn't line up with its neighbour (a wall or a pit at the seam). Pinned by the join test in Task 2.
2. **Seed drift:** the `layout` stream must always draw 25 numbers (06 §8.7). Pinned in Task 3.
3. **Unfair versions:** a version that is much longer or harder than `v1`. The ±10% main-path rule is tested; the user plays each version (hand-off).
4. **Ghost / best mix-ups in practice:** ghosts only replay on the same layout code (Task 5).

---

## Part A — the system, on Plains

### Task 1: Variant source format and the level pack

**Files:** `levels-src/<levelId>/` (new layout), `scripts/build-levels.mjs` (or `tools/build_levels.py`, whichever builds levels today), tests.

- [x] **Source layout:** move each section into `levels-src/<levelId>/s<N>/v1.txt` (the current `s<N>.txt`, unchanged) with a small `s<N>/v1.json`: `entry: [tx, ty]` and `exit: [tx, ty]` (anchor tiles, relative to the chunk's top-left), plus the section's `objects` and `mainPath` **relative to the chunk** (moved out of the level manifest). Fixed sections have only `v1`.
- [x] **Build output:** keep `public/levels/<levelId>.json` as the classic (all-`v1`) level, so nothing else changes, and add `public/levels/<levelId>.pack.json`: every section version as a small tile block + objects + main path + anchors.
- [x] **Tests:** rebuilding gives byte-identical files; the classic level equals today's level (06 §13.6 `LevelData` compare).
- [x] **Commit.**

### Task 2: Assembly

**Files:** `src/core/level/assemble.ts` + test.

- [x] `assembleLevel(pack, picks: Record<section, 1|2|3>) → LevelData`: place section 1 at its manifest position; each next section so its entry anchor sits on the previous exit anchor; offset its objects, main path and zones; cells outside all chunks are solid (06 §13.5); renumber object ids in the 06 §13.5 order; map size = bounding box.
- [x] **Tests:**
  - the classic picks give exactly `public/levels/<levelId>.json`;
  - **join test:** at every seam, the floor row continues and the 4 rows above the exit/entry anchor are open on both sides;
  - every version of a section has the same entry and exit height as `v1`;
  - per version, the contents equal `v1`'s (enemy ids and counts per type, elites, packs, object types and counts, 06 §8.7);
  - main path within ±10% of `v1`.
- [x] **Commit.**

### Task 3: Picking the layout from the seed

**Files:** `src/core/run/layout.ts` + test, run start (06 §2.3), save (06 §15).

- [x] **Stream** `layout`, scope `'run'`, created right after `dragon`; 25 draws in the order of 06 §8.7 (stages 1, 2 mountains, 2 swamps, 3, 4; sections 2, 3, 4, 6, 7).
- [x] **Stage load** assembles the stage from its pack with the run's picks.
- [x] **Layout code** `2-1-3-3-2` per stage: on the run summary and death screen (07), in `RunRecord` (06 §15.2, add `layout: Record<StageLevelId, string>`; defaults fill old saves).
- [x] **Tests:** the same seed gives the same picks; the stream always consumes 25 numbers (also when Stage 2 is the other road); the `dragon` draws are unchanged by adding `layout`; over 30 000 seeds each version is picked 33% ± 1%; a full-run determinism test with a non-classic layout.
- [x] **Commit.**

### Task 4: Plains versions 2 and 3

**Files:** `docs/levels/plains.md` (add the new versions), `levels-src/plains/s{2,3,4,6,7}/v2.*`, `v3.*`.

Write the design first: one paragraph and a thumbnail per version in `docs/levels/plains.md`, like the existing sections. Suggested themes (keep each section's purpose, contents and the Stage 1 spacing rule 06 §8.6):

| § | v1 (today) | v2 | v3 |
|---|---|---|---|
| 2 Open Fields | rolling fields | **Riverbank:** a shallow stream with stepping stones and two wooden bridges (no water tiles: dry stones and gaps) | **Windmill hill:** one long gentle climb and descent, groups on terraces |
| 3 Wooded Ravine | climb out of a ravine | **Waterfall cliff:** the wall-jump shaft beside a waterfall backdrop, the slide tunnel behind it | **Fallen trees:** the double jump over log gaps, the shaft inside a hollow tree |
| 4 Old Grove | ground / tree-tops / hollow | Tree-top skip **below** a rock arch; the hollow on the other side | The skip is a ridge path; the side path is a cave under the ridge |
| 6 Forest Canopy | canopy branches | **Rope bridges** between trees (one-way planks) | **Treehouse village** (abandoned): ladders as one-way steps, the merchant on a platform with 15+ flat tiles |
| 7 Sealed Shrine | clearing + shrine | Shrine at the top of a stair, chests on terraces | Sunken shrine reached by drop-throughs |

- [x] **Chunks** for the 10 new versions. `npm run levels`; all 243 combinations validate (Task 2 tests).
- [x] **Screenshots** of every version (`?debug=1&start=plains&section=n&layout=…`, add the `layout` debug param, 06 §16). **Read them.**
- [x] **Commit.**

### Task 5: Practice mode and the seed board

- [x] **Practice setup** (07 §7.4) gets a **Layout** row: `Random`, `Classic`, or a version per varying section (left/right per section).
- [x] **Practice best and ghost** are stored per layout code (key `${level}|${class}|${code}`); a ghost recorded on another layout is not drawn (06 §8.7). Migrate old practice bests and ghosts to the classic code.
- [x] **Seed entry** (07 §6.12) shows the Plains layout code for the typed seed.
- [x] **Tests** for each; e2e: practice Plains with a chosen layout, finish, see the best saved under that code.
- [x] **Commit.**

### Task 6: Part A hand-off

- [x] Run everything; push to `main`.
- [x] Send the user the screenshots of every Plains version and the live link. Tell them in plain words: "Stage 1 now changes a little every run. Each of 5 sections has 3 versions, so there are 243 different Stage 1s. The same seed always gives the same layout, and practice mode lets you pick versions." Ask which versions they like or dislike, and whether any feel unfair.

## Part B — the other stages

### Task 7: Versions for mountains and swamps

- [x] For each level: design the 10 new versions in `docs/levels/mountains.md` / `swamps.md` first (keep each section's gimmick from 06 §8.3: the great climb with falling rocks, ice and the minecart ride ≥ 120 tiles in §6, the cracked-wall skip; swamp water ≥ 30% in §2, §3, §6, dark zones, the grapple-vine skip), then chunks, validate all 243, screenshot every version, **read them**. One commit per level.

### Task 8: Versions for kingdom and castle

- [x] Same for `kingdom` (town streets vs rooftops, cannons in §3 and §6) and `castle` (spike floors, swinging blades, collapsing bridges, cannon gallery, wall-jump towers). Then run everything, push, and send the user a screenshot of one version per section and stage.

## Done when

- All 5 stages have 3 versions of sections 2, 3, 4, 6 and 7; all 243 combinations per stage validate.
- The classic layout is unchanged; same seed = same layout; practice can pick versions.
- The user has played a few runs and given feedback.

**Next plan:** M12 (character customization), written by the design chat after M11.
