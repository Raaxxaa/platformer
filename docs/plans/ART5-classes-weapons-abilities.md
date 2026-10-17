# ART5: Class Weapons and Abilities (M4 Art) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All the art and sound M4 uses, plus the popup skin and HUD plates, (`docs/plans/M4-classes-abilities-weapons-basics.md`):
- the 6 new starting weapons: Katana, Iron Fists, Bow, Crossbow, Storm Hammer, Staff;
- the player projectiles they fire;
- the ability poses and effects of the 8 M4 abilities;
- weapon, ability and class sounds.

**Architecture:** Same pipeline as ART4: `tools/art/weapons.py`, `poses/player.py`, `vfx.py`, the `projectiles` atlas, `tools/audio/sfx_defs.py`.

**Tech Stack:** Python 3, Pillow, numpy, `unittest`.

**Spec:** `docs/spec/08-art-audio.md` §6.2 (ability poses), §6.3 (weapon anims), §11 (projectiles, `pin_bolt`, `mark`, `link`, ability VFX), §12.4 (weapons and smears), §13.3 (sounds). Weapon data (steps, boxes, projectile sizes): `docs/spec/02-combat.md` §10.2–10.5 and §11. Abilities: `docs/spec/03-classes-abilities.md` §8–§12.

**Starting point:** ART4 on `main` (it builds `weapons.py` and the attack-pose system). Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints

- All ART1–ART4 constraints hold, including **never break `main`** (leave anims the game can't play yet out of `anims.json` and log them).
- Only touch `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`.
- Weapon frames 160 × 96, anchor (80, 72). Body poses go in every `player_<outfit>` atlas and its trims.

## Review Focus

1. **Smears that miss the hitbox** (as in ART4).
2. **Charge poses too similar to idle:** a charging player must look tense and ready.
3. **Ability effects hiding enemies:** effects use alpha and stay thin; Arrow Rain and Thunder Strike must not cover the enemy's telegraph flash.
4. **Projectiles that don't point where they fly:** each is drawn facing right so the code can rotate it.

---

### Task 1: Melee weapons — Katana and Iron Fists

- [ ] **Tests first:** `weapon_katana` (`atk_katana_1..3`, `charge_katana` 2, `atk_katana_charged` 5), `weapon_iron_fists` (`atk_iron_fists_1..4`); smears per step covering 02's boxes; dives (2 each); body poses in all outfits.
- [ ] **Draw:** Katana: a thin curved blade, fast flat slashes, and a dash-slash whose active frames stretch forward. Iron Fists: steel gauntlets, quick jabs, and a big rising uppercut on step 4.
- [ ] **Look, commit.**

### Task 2: Ranged weapons — Bow, Crossbow, Staff

- [ ] **Tests first:** `weapon_bow` (`atk_bow_1`, `charge_bow`, `atk_bow_charged`), `weapon_crossbow` (`atk_crossbow_1`), `weapon_staff` (`atk_staff_1`, `charge_staff`, `atk_staff_charged`); projectile-step frame rule (08 §6.3: frame 2 is the release); dives.
- [ ] **Projectiles** (atlas `projectiles`, drawn facing right, sizes from 02 §10.4): `arrow` 12 × 4, `arrow_charged` 16 × 4 with a glowing tip, `bolt` 14 × 4, `staff_bolt` 8 × 8, `orb` 14 × 14 (2 frames, pulsing). Plus `pin_bolt` (the bolt stuck in place).
- [ ] **Look, commit.**

### Task 3: Storm Hammer

- [ ] **Tests first:** `weapon_storm_hammer` (`atk_storm_hammer_1..2`, `atk_storm_hammer_throw` 5, dives); the thrown hammer in `projectiles` (16 × 16, spin 4 at 20 fps); the dive lightning bolt (`0, −80, 32, 160`, 4 frames at 30 fps) in `vfx`.
- [ ] **Draw:** a stone-and-gold hammer head with a blue-white lightning rune. While it is thrown, the weapon layer is empty (08 §6.3).
- [ ] **Look, commit.**

### Task 4: Ability poses

- [ ] **Body poses** in every outfit (08 §6.2): `cast_slam` 4 (Shockwave), `cast_up` 3 (Arrow Rain and Thunder Strike), `spin` 4 (Whirlwind), `shoulder` 2 (Shoulder Charge). Blade Dash uses `dash`. Hunter's Mark, Blink and Vampire have no pose.
- [ ] **Tests:** keys and counts; body and trims identical; feet on row 45.
- [ ] **Look, commit.**

### Task 5: Ability effects

Atlas `vfx` (08 §11 "Abilities" row and others):

| Ability or event | Frames |
|---|---|
| Blade Dash | 96 × 6 slash line, 3 at 24 fps |
| Whirlwind | 48 × 32 spin smear, 4 at 24 fps, loop |
| Shockwave | ground shock `2R × 44`, one per level width (R = 56, 64, 72, 84, 96), 5 at 24 fps |
| Shoulder Charge | speed lines; rubble for `wallBroken` |
| Arrow Rain | 4 × 12 falling arrow |
| Thunder Strike | 24 × 160 bolt, 4 at 30 fps |
| Blink | 24 × 32 puff, 4 at 24 fps |
| Hunter's Mark | `mark` 16 × 16 reticle, 4 at 8 fps (a `w_gold` version for linked marks) |
| Link | `link` 32 × 32 `w_gold` ring, 4 at 24 fps |

- [ ] **Tests:** ids, sizes, counts, palette lock; effects are mostly transparent (at most 40% opaque pixels per frame, except the Thunder Strike bolt core).
- [ ] **Look, commit.**

### Task 6: Sounds

From 08 §13.3:
- weapons: `shot_bow`, `shot_crossbow`, `shot_staff`, `shot_orb`, `hammer_throw`, `hammer_return` (loop), `hammer_catch`, `zap`;
- abilities: `ab_blade_dash`, `ab_whirlwind`, `ab_shockwave`, `ab_shoulder_charge`, `ab_arrow_rain`, `ab_hunters_mark`, `ab_thunder_strike`, `ab_blink`, `ab_link`, `ab_fizzle`, `ab_not_ready`, `wall_break`;
- classes: `class_change`, `class_discovered`.

- [ ] **Tests** as in ART4. Add them to the listening sheet. **Commit.**

### Task 7: Training Yard pieces

For the tutorial level (`docs/levels/training-yard.md`, 04 §2.11–2.12):

| Thing | Atlas, size | Anims |
|---|---|---|
| `sparring_dummy` | `enemies_extra`, 48 × 48 idle/hit; `atk_*` 96 × 48 (anchor (48, 46)) | `idle` 1, `tele` 2 (raising a wooden sword), `atk_practice_swing` 3, `hit` 3 at 20 fps. The reach rule (08 §4.1) holds for its box `24, −16, 40, 28` |
| `straw_target` | `enemies_extra`, 32 × 32, anchor (16, 30) | `idle` 1, `death` 4 (straw bursting) at 20 fps |
| `station_sign` | `objects`, 24 × 32 | — (a wooden sign; the code writes the text above it) |
| `station_flag` | `objects`, 8 × 24 | `grey` and `green` frames |
| `training_gate` | `objects`, 32 × 64 | — (a wooden arch with a straw-dummy emblem, for the Home Village's left edge) |

- [ ] **Tests:** sizes, palette lock, reach rule. As with the training dummy, leave these anims out of `anims.json` if the game can't play them yet, and log it.
- [ ] **Look, commit.**

### Task 8: HUD plates and popup skin

New `ui` atlas frames (07 §3.4, now 103 frames): `hud_heart` 10 × 10, `hud_plate_9`, `panel_9`, `panel_9_edge` (tint), `tab_on_9`, `tab_off_9`, `button_9`, `button_9_sel`, `cursor`. Look:
- **Panels:** dark slate fill (07 `panel` color) with a carved wood-and-iron border, small rivets in the corners; readable text area in the middle (the middle cell is plain).
- **HUD plate:** the same look but lighter weight and thinner border, drawn at alpha 0.75.
- **Tabs and buttons:** small wooden plaques; the selected or active one is brighter with a `highlight` gold edge. The cursor is a small gold arrow.
- **Heart:** a red pixel heart with a white shine.

- [ ] **Tests:** all 103 `ui` frames with 07's sizes (08 §12.8 check 3), 9-slice frames tile cleanly (corners unchanged, edges repeat without seams), tint frames #ffffff only.
- [ ] **Mock** `tools/out/preview/ui_mock.png` at 2×: the full HUD over the Plains (using 07 §4.1 positions), an item card with two slot choices, and the pause menu on its `LOADOUT` tab. **Look**, show the user, **commit**.

### Task 9: Class board and hand-off

- [ ] **Board** `tools/out/preview/style_board_classes.png`: 4 rows, one per class, each in its outfit with its 2 starting weapons mid-attack and its 2 M4 abilities mid-effect next to a training dummy. Class trim colors from 08 §3.4.
- [ ] **Run** `npm run assets`, all `tools/tests`, `npm run test:e2e`. Two builds identical.
- [ ] **Copy** to `docs/art/style_board_classes_v1.png`. Commit and push to `main`.
- [ ] **Hand-off:** show the user the board and play the sounds. Ask:
  - Does each class look and feel different?
  - Are the weapons clear in motion?
  - Are the ability effects too big or too small?

  On approval, copy to `tools/approved/` and log it.

## Done when

The class board is approved (or changes are listed), all checks pass, and `main` is green.
