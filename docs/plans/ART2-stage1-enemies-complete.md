# ART2: Finish Stage 1 Enemies (Great Boar, projectiles, effects, sounds) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Stage 1 enemy is complete in art and sound:
- the **Great Boar** boss atlas;
- the Stage 1 **enemy projectiles**;
- the **hit, stun and dust** effect sprites the enemies need;
- **sound effects** for every Stage 1 enemy and for combat hits.

The five regular enemies already have full animations from ART1.

**Architecture:** Extend the ART1 pipeline in `tools/`. Add `tools/art/bosses/great_boar.py` (quadruped rig, bigger), `tools/art/projectiles.py`, `tools/art/vfx.py`, and the sound synth `tools/audio/synth.py` + `tools/audio/sfx_defs.py` (08 §13.1). Outputs go to `public/assets/` with the final names from 08, so the builder can wire them in without changes (plan `V1-stage1-sprites-and-sound.md`).

**Tech Stack:** Python 3, Pillow, numpy, stdlib `wave`, `unittest`.

**Spec:** `docs/spec/08-art-audio.md`:
- §4.1 (frame sizes; Great Boar 160 × 112, anchor (80, 110));
- §7.1, §7.2, §7.4 (standard set, attack frame rule, boss anims);
- §11 (VFX list: `hit_spark`, `hit_heavy`, `crit_spark`, `stun_stars`, `dust_land`, `death_burst` colors, projectile sprites, telegraph markers);
- §12 (pipeline);
- §13 (sound format, synth, list).

Also `04-enemies-bosses.md` §8 (projectile sizes) and §10.1 (Great Boar attacks and boxes).

**Approval already given:** the user approved `style_board_plains` (v1) as the first version. Before Task 1, copy it to `tools/approved/` and log it in `tools/approved/APPROVALS.md`: date, file, commit, note "approved as first version".

## Global Constraints

- All ART1 constraints still hold: palette lock, outline rules, hue families, determinism, frames not trimmed, previews checked with the Read tool.
- The Great Boar uses `en_slate`, `en_red`, `en_bone` only (08 §7.4). It must look like a **giant version of the Wild Boar**: same features, bigger, scarred, with heavier tusks.
- **Sounds** (08 §13.1):
  - WAV, PCM 16-bit, 44 100 Hz, mono, ≤ 2.0 s, peak normalized to −1 dBFS;
  - 1 ms fade-in and 5 ms fade-out;
  - variants named `<id>_1.wav`, `<id>_2.wav`;
  - same seed gives identical bytes.
- Only touch `tools/`, `public/assets/`, `docs/art/`.

## Review Focus

1. **The boss's attack art doesn't cover its hitbox:** players get hit by "air". The reach rule must hold for every Great Boar attack box. Pinned in Task 1.
2. **The charge telegraph is unreadable:** the Tele frames must clearly show the boar lowering its head and pawing the ground. Checked on the preview in Task 1.
3. **Projectiles blend into the background:** the contrast report covers projectiles too. Pinned in Task 2.
4. **Sounds clip or are silent:** each WAV is peak-normalized to −1 dBFS and has non-zero energy. Pinned in Task 4.
5. **Sounds too loud or harsh** (the AI can't hear them): render a listening sheet for the user. Task 5.

---

### Task 1: Great Boar atlas

**Files:**
- Create: `tools/art/bosses/__init__.py`, `tools/art/bosses/great_boar.py`, `tools/tests/test_great_boar.py`
- Modify: `tools/art/boxes.py` (Great Boar hurtbox 64 × 40 and its attack boxes from 04 §10.1), `tools/build_assets.py`

**Produces:** atlas `boss_great_boar`. All frames are 160 × 112 with anchor (80, 110). The anims:

| Anim | Frames |
|---|---|
| `idle` | 4 |
| `walk` | 6 |
| `hurt` | 1 |
| `stagger` | 2 |
| `death` | 9 (once at 6 fps; the white flash is done in code) |
| `intro` | 6 (rearing up and snorting) |
| `break` | 3 (collapsing to its knees) |
| `transition` | 6 (unused by Guardians, but required by 08 §7.4) |
| `dazed` | 2 (stars come from VFX) |
| `atk_charge` | Tele 2 (head down, pawing), Act = run loop 4 at 16 fps, Rec 2 |
| `atk_tusk_toss` | Tele 2 + Act 1 + Rec 2 |
| `atk_stomp_quake` | Tele 2 (rearing) + Act 1 (slam) + Rec 2 |

Each anim gets an `anims.json` entry.

- [ ] **Step 1: Write the failing tests.**
  - Every anim exists with the right frame count and size.
  - **Reach rule:** every Great Boar attack box (`28,−20,40,36`; `36,−24,48,48`; `0,−8,96,16`) fits inside the 160 × 112 frame.
  - **Silhouette:** the idle silhouette is within ±3 px of the 64 × 40 hurtbox.
  - **Hue:** no pixel color equals a Plains terrain, background or sky color.
- [ ] **Step 2: Run** `python3 -m unittest discover tools/tests`. Expected: FAIL.
- [ ] **Step 3: Implement** with the quadruped rig scaled up. Add a mane of `en_red` spikes, big curved `en_bone` tusks, scars, and a small glowing eye.
  - **Look at** `boss_great_boar_sheet.png` and the `atk_charge`, `atk_stomp_quake` and `death` GIFs.
  - It must read as the Wild Boar's huge, angry parent.
  - The charge wind-up must be obvious.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "art: Great Boar boss atlas"`

### Task 2: Projectiles and Stage 1 VFX sprites

**Files:**
- Create: `tools/art/projectiles.py`, `tools/art/vfx.py`, `tools/tests/test_projectiles_vfx.py`

**Produces:**
- **`projectiles` atlas.** All projectiles are drawn facing right; the game rotates them.

  | Projectile | Size | Look |
  |---|---|---|
  | `enemy_arrow` | 12 × 4 | Wooden shaft, `en_slate` head |
  | `brute_wave` | 16 × 12 | Dirt-and-rock wave, 2 frames |
  | `shockwave` | 16 × 16 | 2 frames |
  | `falling_rock` | 18 × 18 | Plus a 4-frame shatter |

  Allowed ramps: `en_*`, `gray`, `ink`, `white`. No Plains terrain colors.
- **`vfx` atlas** (08 §11):

  | Effect | Size | Frames |
  |---|---|---|
  | `hit_spark` | 16 × 16 | 3 |
  | `hit_heavy` | 32 × 32 | 4 |
  | `crit_spark` | 24 × 24 | 4 |
  | `stun_stars` | 16 × 8 | 4 (loop) |
  | `dust_land` | 24 × 8 | 4 |
  | `dust_jump` | 16 × 8 | 4 |
  | `muzzle` | 8 × 8 | 2 |

  Spark cores are white, so the element color can be added in code. Debris pieces are 2 × 2 frames.

- [ ] **Step 1: Write the failing tests.**
  - All frames exist with the 08 sizes.
  - The palette lock holds.
  - The contrast report gains lines for the 4 projectiles against Plains, with no FAIL.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Look at the sheets.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "art: Stage 1 projectiles and hit/stun/dust effects"`

### Task 3: Sound synth

**Files:**
- Create: `tools/audio/__init__.py`, `tools/audio/synth.py`, `tools/tests/test_synth.py`

**Produces:** `render(recipe: list[Layer], seed: int) -> np.ndarray` (float32, 44 100 Hz).
- Each `Layer` has a wave (`sq` with duty, `saw`, `tri`, `sin`, `nz`), start → end frequency (exponential slide), attack / sustain / decay, optional vibrato, arpeggio steps, one-pole low- or high-pass with a cutoff sweep, bit-crush, and a level.
- `write_wav(path, samples)`: normalized to −1 dBFS peak, 1 ms fade-in, 5 ms fade-out, 16-bit mono.
- `variant(recipe, k)` re-seeds and shifts every frequency by ±4%.

- [ ] **Step 1: Write the failing tests.**
  - A 100 ms `sin 440` has length 4410 samples and its strongest frequency is within 440 ± 5 Hz.
  - The peak after `write_wav` is −1 dBFS ± 0.1.
  - The first and last samples are within ±64.
  - The same seed gives the same bytes.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "audio: sfxr-style synth"`

### Task 4: Stage 1 enemy and combat sounds

**Files:**
- Create: `tools/audio/sfx_defs.py`, `tools/tests/test_sfx_stage1.py`
- Modify: `tools/build_assets.py`

**Produces** `public/assets/audio/sfx/<id>.wav` with the variant counts from 08 §13.3, for these ids:

| Group | Ids |
|---|---|
| Enemy voices | `vo_wolf` (growl), `vo_bandit` (grunt "hey"), `vo_bandit_archer` (short whistle), `vo_wild_boar` (squeal), `vo_bandit_brute` (deep roar) |
| Great Boar | `boss_roar_great_boar` (1.2 s distorted formant squeal-roar), `boss_break`, `boss_defeated` |
| Enemy swings and deaths | `enemy_swing_s`, `enemy_swing_m`, `enemy_swing_l`, `enemy_death_s`, `enemy_death_m`, `enemy_death_l` |
| Projectiles and impacts | `proj_enemy_arrow`, `proj_brute_wave`, `proj_shockwave`, `rock_shatter`, `rock_whistle` |
| Player hits | `hit_light`, `hit_medium`, `hit_heavy`, `hit_crit`, `swing_light`, `swing_medium`, `swing_heavy` |
| Player hurt and death | `player_hurt`, `player_death` |
| Movement | `jump`, `double_jump`, `wall_jump`, `land`, `dash`, `slide`, `dive_start`, `dive_land`, `dive_land_heavy`, `dive_bounce`, `step_soft` |
| Flask | `flask_drink`, `flask_sip`, `flask_empty`, `flask_tick`, `flask_charge` |
| Arena, doors, timed door | `door_slam`, `door_open`, `arena_clear`, `timed_open`, `timed_missed` |

Use the 08 §13.3 recipes. Each enemy voice must be clearly different from the others.

- [ ] **Step 1: Write the failing tests.**
  - Every id listed exists with its variant count.
  - Every file is 16-bit mono 44 100 Hz, ≤ 2.0 s, peak −1 dBFS ± 0.1, and has non-zero RMS.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "audio: Stage 1 enemy, combat and movement sounds"`

### Task 5: Listening sheet, determinism, hand-off

**Files:**
- Create: `tools/audio/listen_sheet.py`, `docs/art/sounds_stage1.wav`, `docs/art/sounds_stage1.md`
- Modify: `tools/tests/test_determinism.py` (include the new outputs)

- [ ] **Step 1: Build the listening sheet.** `listen_sheet.py` concatenates every new sound with 0.4 s of silence between them into `docs/art/sounds_stage1.wav`. It also writes `docs/art/sounds_stage1.md`, listing each sound in order with its start time, e.g. `0:03.2 vo_wolf (Wolf notices you)`.
- [ ] **Step 2: Run** `npm run assets` and the tests. Everything passes, and two builds give identical bytes.
- [ ] **Step 3: Commit and push to `main`.**
- [ ] **Step 4: Hand-off to the user.**
  - Send the Great Boar sheet, the charge and stomp GIFs, a projectile and effects preview, and `docs/art/sounds_stage1.wav` with its list.
  - Ask in plain words:
    - Does the Great Boar look like the boss of the plains?
    - Which sounds are too loud, too quiet, too harsh, or not right for that enemy? (Say I can't hear them myself.)
  - Changes to sounds are small fixes. Do them right away.

## Done when

- `npm run assets` builds everything deterministically, and all `tools/tests` pass, including the reach, silhouette, hue, contrast, palette and sound-format checks.
- The user has seen the boss art and heard the sounds, and their feedback has been applied or noted.
