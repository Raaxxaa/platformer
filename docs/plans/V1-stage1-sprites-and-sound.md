# V1: Real Sprites and Sound for Stage 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the grey boxes in the game with the real generated art and add sound:
- the player (starter look);
- all five Stage 1 enemies and the Great Boar;
- projectiles, hit sparks and stun stars;
- the death burst;
- the telegraph flashes;
- Plains tiles and the parallax background.

Sounds play on game events. Gameplay doesn't change at all.

**When:** for the **code chat**, after **M3.1** and with **ART2 and ART4** on `main`.

**Architecture:** A view-only layer in `src/game/`:
- an asset loader for `anims.json` and the atlases;
- an animation picker that uses core state and the 08 §5 clocks (never Phaser's own animation clock);
- overlay flash sprites;
- a small VFX pool;
- an SFX player.

The core is not changed, except for read-only getters if something isn't exposed (log a SPEC-GAP if so). The grey-box drawing stays available with `?boxes=1` for debugging.

**Tech Stack:** Phaser 4.2.1 (atlas loading, sprites, tint FILL mode for flashes, tile sprites for parallax, WebAudio through Phaser's sound manager or directly).

**Spec:** `docs/spec/08-art-audio.md`:
- §4 (frames, anchors, draw order and depths);
- §5 (animation clocks, anim choice, overlays, hit-stop jiggle);
- §6.1 (player anims);
- §7 (enemy and boss anims);
- §9 (tiles, blob autotiling, `hash2`);
- §10.1 (parallax);
- §11 (the VFX listed below);
- §13.2 (SFX playback rules: voices, gaps, pan and distance, browser audio unlock).

Also `07-ui-hud-controls.md` for the "click or press a key to enable sound" note.

## Scope

**In:**
- Player body sprite (the `swordsman` starter look for every class until M12, since the look isn't tied to class), with **every move from ART4** (08 §6.1), picked by 08 §5.2.
- **Weapon layers and smears** for the Greatsword and War Maul, including dives (08 §6.3, ART4).
- **Stage 1 objects from ART4:** arena doors and the timed door (lamps), guide arrows, Plains decoration tiles (08 §9.4).
- **Fonts** (`rb_*`) for the timer, hints and banners.
- Trim tinted with the class color.
- Enemies and the boss, with every anim.
- Overlays: hit flash, telegraph, telegraph "go", spawn-in.
- Hit-stop jiggle.
- VFX: `hit_spark`, `hit_heavy`, `crit_spark`, `stun_stars`, `dust_land`, `dust_jump`, `muzzle`, `death_burst`, telegraph floor markers, plus ART4's movement, flask and Rush effects (`ring_djump`, `dust_walljump`, `dust_wall`, `dust_slide`, `dive_*`, `spike_spark`, `flask_orb`, `heal`, `rush_up`, `dash_refund`, `spawn_in`).
- Projectiles drawn rotated to their velocity in 22.5° steps.
- Plains tiles with blob autotiling.
- Parallax.
- All sounds from ART2, and ART4's movement, Rush, run and menu sounds.

**Out:** the real HUD (M4 builds it with the `ui` atlas), loot art (M5), music.

## Global Constraints

- **The view never decides rules** (08 §1.1). Frames and sounds come from core state and events only.
- View randomness only uses `hash2` (08 §9.2), never the core RNG.
- All sizes, depths and fps come from `anims.json` and 08. No guessing.
- Audio starts only after the first key press or click (browser rule). Show a small "Click or press any key for sound" note until then.

## Review Focus

1. **Animation desync during hit-stop:** frames must freeze while an entity is in hit-stop. Pinned in Task 2.
2. **Sprite offset from the hitbox:** with `?debug=1`, the hurtbox outline must sit on the sprite's feet in every anim. Pinned by the e2e screenshot in Task 6.
3. **Too many sounds at once** (a wolf pack all growling): `maxVoices` and `minGap` must hold. Pinned in Task 5.
4. **Seams between tiles** at 2× and 3× zoom. Checked by screenshot in Task 4.
5. **Missing asset names** (code asks for a frame that isn't in the atlas): a test checks every anim key used in code against `anims.json`. Pinned in Task 1.

---

### Task 1: Asset loading and anim keys

- **Create:** `src/game/assets/loadAssets.ts`, `src/data/animKeys.ts`, `src/data/animKeys.test.ts`.
- **Produces:** a preload that reads `public/assets/anims.json`, loads every atlas it names, `tiles_plains.png` (spritesheet: margin 1, spacing 2) and `bg_plains_0..2.png`. `animKeys.ts` lists every anim key the code uses.
- **Test:** every key in `animKeys.ts` exists in `anims.json`.
- **Commit.**

### Task 2: Animation picker and clocks

- **Create:** `src/game/view/animClock.ts` (pure, unit-tested), `src/game/view/pickAnim.ts`.
- **Produces:** the 08 §5.1 time-driven, phase-driven and speed-driven frame math, and the 08 §5.2 player anim choice (limited to the anims that exist). Enemy anims follow their AI state and attack phase (08 §7.1–7.2).
- **Tests:**
  - phase math: a 3-frame Tele segment at 50% progress shows frame 1;
  - the run fps formula;
  - frames don't advance while an entity is in hit-stop.
- **Commit.**

### Task 3: Sprites, overlays and VFX

- **Create:** `src/game/view/EntitySprites.ts`, `src/game/view/vfx.ts`.
- **Characters:** one sprite plus one overlay sprite each (08 §5.3).
  - Overlays, in priority order: hit flash, telegraph "go", telegraph, spawn-in. They use Phaser 4's FILL tint mode.
  - Hit-stop jiggle.
  - Depths from 08 §4.3.
- **VFX pool:** max 256 objects (08 §11), driven by world events.
- **Projectiles:** rotated in 22.5° steps.
- **`death_burst`:** particles in the enemy's 2 main ramp colors.
- **Telegraph floor markers** for area attacks: Stomp Quake, the falling-rock shadows.
- **Commit.**

### Task 4: Tiles and parallax

- **Create:** `src/core/level/autotile.ts` (pure; 08 §9.2 blob reduce with the same 47 masks as the Python tools), `src/core/level/autotile.test.ts`, `src/game/view/levelView.ts`.
- **Test:** the masks agree with `tools/art/tiles.py`. Mask 0 → index 0, 85 → 21, 124 → 31, 255 → 46. The 256 masks reduce to exactly 47 values.
- **Drawing:**
  - solid cells use blob tiles;
  - mask 255 picks its variant with `hash2`;
  - one-way tiles use their ends;
  - spikes use their tiles;
  - parallax with fx and fy from 08 §10.1.
- **Commit.**

### Task 5: Sound

- **Create:** `src/game/audio/sfx.ts`, `src/game/audio/sfxRules.test.ts` (pure parts).
- **Produces:** the 08 §13.2 playback rules:
  - per-id volume, `maxVoices` and `minGap` 0.03 s;
  - round-robin variants;
  - pitch jitter ±3% from `hash2`;
  - pan and distance falloff for world sounds;
  - 32 voices max.
- **Event → sound mapping** for the ART2 ids:

  | Sound | Trigger |
  |---|---|
  | enemy voice | becoming aware, and the Boar Charge Tele |
  | enemy swing | an enemy Act starts |
  | enemy death | an enemy dies |
  | player swing / hit | weapon steps and direct hits |
  | `player_hurt`, `player_death` | getting hit, dying |
  | movement sounds | movement events |
  | flask sounds | flask events |
  | door sounds | arena and timed door events |
  | boss sounds | intro roar, break, defeated |

- **Tests:**
  - a 4th wolf growl inside the voice limit is dropped;
  - two of the same id 0.02 s apart only play once;
  - pan is −0.5 for a sound 320 px to the left.
- **Commit.**

### Task 6: E2E, screenshots, hand-off

- **E2E:** extend `tests/e2e/stage1.spec.ts`:
  - screenshots of sections 1, 2, 5 and 8 with sprites;
  - a wolf mid-telegraph (orange flash);
  - the Great Boar in its charge Tele;
  - `?debug=1` hitbox outlines on top of sprites, to check that sprites line up with hitboxes.
- **Run** the full check suite, **read every screenshot**, and push to `main` (the site deploys).
- **Hand-off:**
  - Send screenshots and the link.
  - Tell the user, in plain words: Stage 1 now has real art and sound. Click or press a key to turn sound on. Every move and the Greatsword and War Maul swings are animated.
  - Ask how it looks and sounds in motion.
