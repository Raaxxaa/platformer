# ART6: Elements, Signatures and Loot Effects (M5 Art) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The art and sound M5 (loot) still needs. ART4 already made chests, keys, coins, glows, icons and the Lucky Block. This adds:
- the **5 element looks**: hits, status effects on enemies, and element-tinted weapon swings;
- the **S-grade signature move effects** for the 8 built weapons;
- the **Lucky Block break** and **chest opening** effects;
- the element sounds.

**Architecture:** `tools/art/vfx.py`, `tools/art/weapons.py` (smear tints), `tools/audio/sfx_defs.py`.

**Spec:** `docs/spec/08-art-audio.md` §3.5 (element colors), §11 ("Element status", `hit_spark` element rims, `explosion_*`), §12.4 (smears), §13.3 (`fire_hit`, `ice_hit`, `freeze`, `shatter`, `poison_hit`, `wind_hit`). Signature moves: `docs/spec/02-combat.md` §13. Elements: 02 §6.

**Starting point:** ART5 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints

- All ART1–ART5 constraints hold, including **never break `main`**.
- Only touch `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`.
- Element colors are exactly 08 §3.5 (they match 07's UI element colors).
- Photosensitivity rule (08 §11): nothing full-screen flashes more than 3 times a second.

## Review Focus

1. **Elements that look alike:** fire vs wind, ice vs lightning must be told apart at 1× in a busy fight.
2. **Status effects hiding the telegraph flash:** enemy statuses stay small and at the edges of the body.

---

### Task 1: Element hits and statuses

- [ ] **Frames** (atlas `vfx`, sizes per 08 §11): `burn_flame` 6 × 8 (3 at 12 fps), `chill_frost` particles, `freeze_block` (a 9-slice ice frame, so the code can size it to hurtbox + 4 px), `shatter_shards` (8 ice shards), `poison_bubble`, `wind_gust` 24 × 12 (4 at 24 fps). The Lightning chain line is drawn by code (08 §11); add a `chain_spark` 6 × 6 for its ends.
- [ ] **Element-tinted swings:** smear variants or a tint rule so a fire Greatsword's swing has the fire outer color (08 §3.5, §12.4). Prefer a tint the code applies, if the smears are white/grey (check with the code chat's `EntitySprites` in `docs/art/SPEC-GAPS-art.md` if unsure).
- [ ] **Tests:** sizes, counts, palette lock; the 5 elements' mean colors are far apart (OKLab distance ≥ 0.15 between any two).
- [ ] **Look, commit.**

### Task 2: S-grade signature effects

For 02 §13, the 8 built weapons:

| Weapon | Signature | Frames |
|---|---|---|
| Greatsword | Ground Wave | 16 × 20 floor wave, 4 frames loop |
| Katana | Phantom Edge | path detonation: a slash line that bursts, 5 frames, stretched by code to the path |
| War Maul | Quake | 16 × 16 floor wave, 4 frames loop |
| Iron Fists | Thunderclap | 96 × 48 blast, 5 frames |
| Bow | Triple Shot | uses `arrow_charged` (no new frames) |
| Crossbow | Impaler | uses `explosion_s` for the 64 × 64 pin blast |
| Storm Hammer | Tempest | 24 × 24 storm cloud, 4 frames loop |
| Staff | Singularity | a pull swirl around the orb, 64 px radius, 4 frames loop |

Signatures carry the weapon's element: draw them in white/grey so the code tints them with the element color, or make one variant per element if a tint looks bad.

- [ ] **Tests:** sizes, palette lock. **Look, commit.**

### Task 3: Loot effects

- [ ] `lucky_break`: the Lucky Block bursting into gold shards with a "?" pop, 24 × 24, 6 frames.
- [ ] `chest_open`: a small light burst from the lid, 24 × 16, 4 frames (gold for key and timed chests, purple `fx_dark` for the cursed chest).
- [ ] `buff_aura` / `debuff_aura`: a thin ring rising around the player for the moment a Lucky Block result lands, 32 × 48, 6 frames (gold / purple).
- [ ] **Look, commit.**

### Task 4: Sounds

From 08 §13.3: `fire_hit`, `ice_hit`, `freeze`, `shatter`, `poison_hit`, `wind_hit`, plus `explosion_s`/`explosion_l` if not already made. Add them to the listening sheet.

- [ ] **Tests** as in ART4. **Commit.**

### Task 5: Board and hand-off

- [ ] **Board** `tools/out/preview/style_board_loot2.png`: a fight on the Plains with one enemy under each status (burning, chilled, frozen, poisoned, shocked), an S Greatsword's Ground Wave, a Storm Hammer's Tempest clouds, a Lucky Block breaking and an open cursed chest.
- [ ] **Run** `npm run assets`, all `tools/tests`, `npm run test:e2e`. Push to `main`.
- [ ] **Hand-off:** show the user the board. Ask: can you tell the 5 elements apart? Do the S-grade moves feel special enough? On approval, copy to `tools/approved/` and log it.
