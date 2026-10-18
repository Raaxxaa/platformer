# ART7: Stage 2 Biomes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Art and sound for both Stage 2 roads and the Border Village (for M7.1):
- **Caves & Mountains:** tiles (rock, ice, rails), backgrounds (mountain sky, then caves), Bat Swarm, Goblin Miner, Rock Golem, Ram, the Goblin Shaman elite, the **Stone Colossus**, falling rocks, the minecart, cracked wall.
- **Dark Forest & Swamps:** tiles (mud, swamp water frames, roots), backgrounds (dark forest, fog), Bog Zombie, Giant Spider, Will-o'-Wisp, Swamp Witch, the Treant elite, the **Spider Queen** and Spiderlings, grapple vines, fireflies.
- **Border Village** background and props (same layout as the Crossroads, mountain style).
- Their projectiles, effects and sounds; one **style board per biome** for the user to approve.

**Architecture:** The ART1–ART6 pipeline: `tools/art/tiles.py`, `backgrounds.py`, `enemies/`, `bosses/`, `vfx.py`, `village.py`, `tools/audio/sfx_defs.py`, `style_board.py`, `contrast.py`.

**Spec:** `docs/spec/08-art-audio.md`:
- §3.7 (the `mountains` and `swamps` biome ramps, skies and layers; the `border` village);
- §4.1 (frame sizes: elites 128 × 80, Stone Colossus 192 × 144, Spider Queen 192 × 112, Spiderling 40 × 32);
- §7 (enemy anim sets and attack frame rule; §7.3 and §7.4 rows for these enemies and bosses);
- §8 (minecart, cracked wall, grapple point);
- §9 (tileset rows: ice blob tiles, water frames, rails §9.5);
- §10 (parallax, darkness glints, ambient particles);
- §11 (enemy specials: toxic clouds, puddles, Stone Spikes, barrier, bubbles);
- §12.7–12.8 (boards, contrast report, reach rule);
- §13.3 (`vo_*`, projectile sounds, `cart_*`, `splash`, `step_wet`, `step_ice`, `boss_roar_*`).

Enemy sizes, hurtboxes and attack boxes: `docs/spec/04-enemies-bosses.md` §4, §5, §8, §10.2–10.3.

**Starting point:** ART6 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints

- All ART1–ART6 constraints hold: palette lock, outlines, determinism, untrimmed frames, previews read with the Read tool, **never break `main`** (leave anims the game can't play yet out of `anims.json` and log them).
- Only touch `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`.
- **Gate:** each biome's style board must be approved by the user before its Guardian is drawn (08 §12.7).
- Contrast: every enemy against every background layer of its biome (08 §12.8 check 5); the darkness makes swamps harder, so check enemies there at night alpha too.

## Review Focus

1. **Enemies blending into dark backgrounds** (swamps, caves).
2. **Reach rule** for the new attacks (08 §12.8 check 7), especially the Treant's Branch Slam and the Colossus.
3. **Ice and water readability:** the player must see where ice starts and how deep the water looks.

---

### Task 1: Caves & Mountains tiles and backgrounds
- [ ] `tiles_mountains.png` (blob tiles, one-way, spikes, cracked wall, **ice blob tiles**, top and hanging deco, rails). `bg_mountains_0..2` (sky and peaks) and a cave variant for the cave sections (08 §3.7, §10.1). Seamless test, palette lock. **Look, commit.**

### Task 2: Caves & Mountains enemies and style board
- [ ] Bat Swarm, Goblin Miner, Rock Golem, Ram (`enemies_mountains`), Goblin Shaman (elite), with every 08 §7 anim; projectiles `bomb`, `hex_bolt`; Stone Spikes and barrier effects.
- [ ] `style_board_mountains.png` (08 §12.7) + contrast lines. **Show the user; wait for approval.** **Commit.**

### Task 3: Stone Colossus, minecart, falling rocks
- [ ] `boss_stone_colossus` (192 × 144) with Fist Slam, Shoulder Ram, Leap Slam, Rock Rain, break and death; the minecart (`roll` 2 frames), the falling rock and its floor marker (reuse ART2's if it fits), cracked-wall rubble.
- [ ] **Look, commit.**

### Task 4: Dark Forest & Swamps tiles and backgrounds
- [ ] `tiles_swamps.png` (blob tiles, one-way roots, spikes, **water surface and body frames**, deco). `bg_swamps_0..2` (dark forest and fog), fireflies, grapple vine point. **Look, commit.**

### Task 5: Dark Forest & Swamps enemies and style board
- [ ] Bog Zombie (submerged bubbles, rise), Giant Spider (hanging thread, drop, pounce), Will-o'-Wisp (swell, explode), Swamp Witch, Treant (elite, Root Snare marker, Branch Slam); projectiles `potion`, puddle, toxic cloud.
- [ ] `style_board_swamps.png`, including a dark-zone corner lit by fireflies and the player's light. **Show the user; wait for approval.** **Commit.**

### Task 6: Spider Queen and Spiderlings
- [ ] `boss_spider_queen` (192 × 112): Ceiling Drop (climb, drop), Fang Strike, Pounce, Venom Spit (`venom_glob`), Brood; Spiderling (40 × 32) in `enemies_extra`. **Look, commit.**

### Task 7: Border Village
- [ ] `bg_village_border_0..2` (mountain town, evening), its stall roof and inn front in the mountain style, using the Crossroads layout (06 §12.2) so every prop fits the same spots. **Look, commit.**

### Task 8: Sounds and hand-off
- [ ] `vo_` voices for all 10 new enemies, their projectile sounds, `boss_roar_stone_colossus`, `boss_roar_spider_queen`, `cart_roll`, `cart_jump`, `cart_crash`, `splash`, `step_wet`, `step_ice`, `rock_whistle`/`rock_shatter` if not already made. Listening sheet `docs/art/sounds_stage2.wav`.
- [ ] Run `npm run assets`, all `tools/tests`, `npm run test:e2e`; push to `main`.
- [ ] **Hand-off:** show the user both boards, both Guardians and the village; play the sounds. On approval, copy the boards to `tools/approved/` and log them.
