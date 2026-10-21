# ART8: Stage 3-4, Dragon, New Weapons and Sounds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace every grey placeholder that M9 left in the game with real, generated art and sound:
- **Stage 3 Enemy Kingdom:** `kingdom` tiles, backgrounds (`bg_kingdom_0..2`), Soldier, Crossbowman, War Hound, Battle Mage, Knight (elite), cannon (+ muzzle glow, cannonball), **Black Knight** boss.
- **Stage 4 King's Castle:** `castle` tiles, backgrounds (`bg_castle_0..2`), Royal Guard, Gargoyle, Castle Mage, Living Armor, Royal Executioner (elite), swinging blade, collapsing bridge, **Enemy King** (+ decree guards, Throne Beam, orbs, falling swords, shockwave).
- **Dragon** in 4 colors (`boss_dragon_red|white|storm|green`), its breath cone, fire pools, ice spikes, thunder columns, toxic clouds, wing gust, `dragon_shadow`.
- **Rebel Camp** village look (`village_rebel_camp`: `kg_stone` + `vl_*`, night) — 08 §3.7 lists it, so it gets `bg_village_rebel_camp_0..2`.
- **11 new weapons** (in-hand sprites + smears + body poses for every outfit): Twin Daggers, Spear, Scythe, Giant Axe, Flail, Shield, Hand Cannon, Javelin, Throwing Knives, Wand, Spell Tome. Icons already exist (ART5); their shots/effects: cannonball, javelin (+ the stuck-javelin platform), knife, wand rune shot, tome shots, shield reflect.
- **8 new abilities:** art for their effects already exists from ART5 (`ab_*`, `whirlwind`, `mark`, …). Anything missing is listed and drawn; their sounds are added.
- **Sounds** per 08 §13.3 for all of the above.
- One **style board per biome** (Kingdom, Castle), a **bosses board**, a **weapons board**, and the contrast report, for the user to approve.

**Architecture:** the ART1–ART7 pipeline: `tools/art/tiles.py`, `backgrounds.py`, `enemies/`, `bosses/`, `weapons.py`, `poses/player.py`, `projectiles_stage2.py`/`projectiles.py`, `objects.py`, `vfx.py`, `village.py`, `tools/audio/`, `style_board_stage2.py`, `contrast.py`. New modules: `enemies/kingdom.py`, `enemies/castle.py`, `bosses/black_knight.py`, `bosses/enemy_king.py`, `bosses/dragon.py`, `projectiles_stage34.py`, `style_board_stage34.py`, `audio/sfx_stage34.py`.

**Spec:** `docs/spec/08-art-audio.md` §3.7 (kingdom, castle, village_rebel_camp, Dragon ramps), §4.1 (frame sizes), §6.3 (weapon keys), §7.3–7.4 (anim sets), §8 (cannon 24 × 16, swinging blade, collapsing platform), §9 (tile rows), §10 (parallax), §11 (specials), §12.8 (checks), §13.3 (sounds). Enemy numbers: `docs/spec/04-enemies-bosses.md` §6, §7, §9, §11–§13.

**Starting point:** M9 on `main`.

## Global constraints

- All ART1–ART7 rules hold: palette lock, outlines, determinism, untrimmed frames, previews read with the Read tool, **never break `main`** (anims the game cannot play yet stay out of `anims.json` and are logged in `docs/art/SPEC-GAPS-art.md`).
- Only `tools/`, `public/assets/`, `docs/art/`, `docs/plans/ART8*`, the `assets` line of `package.json`, plus minimal Phaser-layer wiring in `src/game/` and the data registries `src/data/animKeys.ts` / `src/data/sfx.ts` (no game rules, nothing in `src/core/`).
- Never copy anything into `tools/approved/`; boards are approved by the user at the end.
- Contrast: every new enemy against every layer of its biome (08 §12.8 check 5). Dark Castle (`cs_stone` darkest) is the risk; steel and gold enemies need light edges.

## Frame sizes (08 §4.1)

| Thing | Frame | Notes |
|---|---|---|
| Soldier, Crossbowman, War Hound, Battle Mage, Castle Mage, Living Armor, Gargoyle | 48 × 48, `atk_*` 96 × 48 | anchor (24,46) / (48,46) |
| Royal Guard | 176 × 64, anchor (88, 62) | all anims |
| Knight (elite) | 128 × 80, (64, 78) | |
| Royal Executioner | 128 × 96, (64, 94) | |
| Black Knight / Enemy King / Dragon | 144 × 96 / 160 × 112 / 288 × 192 | (w/2, h − 2) |

## Tasks

### Task 1 (A): this plan
- [x] Write and push `docs/plans/ART8-stage3-4-bosses-weapons.md`.

### Task 2 (B): Weapons and abilities
- [x] Add body poses (shared by all four outfits) and weapon segments for the 11 new weapons, with every 08 §6.3 key: Twin Daggers 1–4; Spear 1–3 + `lunge`; Scythe 1–3; Giant Axe 1–2 + `spin` (6); Flail 1–2 + `charge`/`charged`; Shield `shield_up`, `atk_shield_bash`, `shield_lower`; Hand Cannon 1; Javelin 1; Throwing Knives 1; Wand 1; Spell Tome 1–3; `dive_*` frames for each.
- [x] Projectiles (`projectiles` atlas): `cannonball` (10 × 10), `javelin` (20 × 4), `javelin_stuck` platform frame, `knife` (8 × 4), `wand_shot` (6 × 6 rune, 2 frames), `tome_bolt`/`tome_rune` (per 02 §10.4), `skewer`, `soul`, `reflected`; muzzle flash for the cannon.
- [x] Wire: `WEAPON_ART` in `src/data/animKeys.ts`, `PROJECTILE_ANIMS`, player projectile view. Anything the game cannot play stays out of `anims.json`.
- [x] Ability effects: audit 03 against the `vfx` atlas; add what is missing.
- [x] **Look at the weapons board and every sheet, commit, push.**

### Task 3 (C): Enemy Kingdom and the Black Knight
- [x] `tiles_kingdom.png` (stone, roof, banners, spikes, cannon-wall deco), `bg_kingdom_0..2` (distant city, walls, houses), `bg_village_rebel_camp_0..2` and its props, embers in the ambience.
- [x] `enemies_kingdom`: Soldier (guard stance, `guard_hit`), Crossbowman (`aim` 5 frames), War Hound (`en_steel` + `en_red` collar), Battle Mage, Knight; cannon object (24 × 16, muzzle glow 2 @ 10 fps) in `objects`; projectiles `enemy_bolt`, `fireball`, `dark_wave`.
- [x] `boss_black_knight` (144 × 96): idle, walk, `triple_slash` (3 hits + phase-2 4th), `lunge_thrust`, `shield_bash`, `dark_wave`, `leap_slam`, `bulwark`, intro, break, transition, death.
- [x] `style_board_kingdom.png`, contrast lines. **Commit, push.**

### Task 4 (D): King's Castle and the Enemy King
- [x] `tiles_castle.png` (stone, trim, carpet, collapsing bridge cells), `bg_castle_0..2` (arched windows, pillars, banners), swinging blade object (pivot, chain link, blade 24 × 24).
- [x] `enemies_castle`: Royal Guard, Gargoyle (`stone`, `wake`, `fly`), Castle Mage (`channel`), Living Armor (`collapse`, `pile`, `rise`), Royal Executioner.
- [x] `boss_enemy_king` (160 × 112) with every 04 attack, Throne Beam fade (alpha), decree guards (Royal Guard reuse), projectiles `arcane_bolt`, `royal_orb`, `falling_sword`, `fire_rain`.
- [x] `style_board_castle.png`. **Commit, push.**

### Task 5 (E): The Dragon in 4 colors
- [x] One base drawing in four template shades recolored to `dr_red|dr_white|dr_storm|dr_green` → atlases `boss_dragon_<color>` (288 × 192): idle/`perched`, `walk`, `takeoff`, `hover`, `dive`, `fall`, `wing_hop`, `breath_loop`, claw swipe, tail sweep, wing gust, color special, dive bomb, strafing breath, intro, break, transition, death.
- [x] `vfx`: breath cone per color, ice spikes, thunder column, toxic cloud (reuse swamp frames recolored), `dragon_shadow`.
- [x] Wire `boss_dragon_<color>` into the enemy bank. **Commit, push.**

### Task 6 (F): Sounds, boards, approvals
- [x] `tools/audio/sfx_stage34.py`: `vo_` for the 10 new enemies, `proj_` for the new enemy projectiles, `boss_roar_black_knight`, `boss_roar_enemy_king`, `dragon_roar`, `breath_<color>`, `wing_flap`, `cannon_fuse`, `cannon_fire`, `blade_swoosh`, new weapon sounds (`shot_cannon`, `throw_javelin`, `throw_knives`, `shot_wand`, `tome_blast`, `rune_ring`), shield sounds, the 8 new ability sounds, `step_hard`, `platform_shake`, `tele_unblockable`. Listening sheet `docs/art/sounds_stage34.wav` + `.md`.
- [x] `style_board_bosses.png` and `style_board_weapons.png`; the contrast report; `tools/approved/APPROVALS.md` is **not** touched. Log the pending boards in `docs/art/APPROVALS.md` as "waiting for the user".
- [x] `npm run assets`, `typecheck`, `test`, `build`, `test:e2e` (with two screenshots proving the new art shows). **Push.**
