# ART4: Finish Stage 1 Art and Loot Art — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything Stage 1 and loot still need, so the code chat can wire it all in one go:
- the player's **full move set** in all 4 outfits (today only `idle` and `run` exist);
- the two Stage 1 weapons, **Greatsword** and **War Maul**, with attack, smear and dive frames;
- the missing Stage 1 objects: doors, the timed door, guide arrows, tile decorations;
- **loot**: chests, keys, coins, blueprint, ground-item glows;
- the full **`ui` atlas** (every icon the HUD and item cards use) and the **fonts**;
- the movement, flask, Rush and loot **effects**;
- the movement, loot, shop and menu **sounds**.

Weapons and abilities for the classes (M4) are the next art plan, ART5.

**Architecture:** Extend the ART1–ART3 pipeline:
- `tools/art/poses/player.py` gets every 08 §6.1 pose; `outfits.py` draws them for all 4 outfits;
- new `tools/art/weapons.py` (08 §12.4);
- new `tools/art/ui.py` and `tools/art/fonts.py` (08 §12.5);
- `items.py`, `vfx.py`, `tiles.py`, `village.py` (objects) and `tools/audio/sfx_defs.py` grow.

All names, sizes and frame counts are 08's, so the code needs no guessing.

**Tech Stack:** Python 3, Pillow, numpy, `unittest`.

**Spec:** `docs/spec/08-art-audio.md`:
- §4.1 (frame sizes and anchors), §4.2 (player composition);
- §5.2 (which anim plays when; the poses must read clearly in that order);
- §6.1 (player anims), §6.3 (weapon anims), §6.4 (outfits);
- §8 (items, objects, icons);
- §9.1 rows 7–8 (deco tiles), §9.4 (auto-decoration);
- §11 (VFX);
- §12 (pipeline, rig, weapons and smears, atlases, `ui` atlas, fonts, previews, checks);
- §13.1 and §13.3 (sounds).

Also `docs/spec/07-ui-hud-controls.md` §2.1 (font metrics and charset) and §3.4 (the `ui` atlas list), and `docs/spec/05-loot-economy.md` for the ids of stats, Lucky Block effects and curses.

**Starting point:** ART1–ART3 on `main`, and `style_board_villages_v1` approved. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first. On approval, also copy `docs/art/style_board_villages_v1.png` to `tools/approved/` and log it (the user approved it).

## Global Constraints

- All ART1–ART3 constraints still hold: palette lock, outlines, determinism, frames not trimmed, previews checked with the Read tool.
- Only touch `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`.
- **Never break `main`.** After each task: `npm run assets`, all `tools/tests`, and `npm run test:e2e`. If the game code can't handle a new anim yet (like the dummy in ART3), build the frames but leave the anim out of `anims.json`, and log it in `docs/art/SPEC-GAPS-art.md` for the code chat.
- **Player frames:** body and both trim layers have identical frame lists (08 §12.8 check 4). Feet on row 45, rows 46–47 empty.
- **One pose table** for all outfits (08 §12.3). Outfits only swap parts.

## Review Focus

1. **Poses that don't read at 1×:** jump vs fall, dash vs slide, wall slide vs ledge climb must be clear at game size. The user checks the movement sheet.
2. **Feet sliding:** every frame keeps the feet on the anchor; a test checks the lowest opaque row is 45 in grounded anims.
3. **Smears that miss the hitbox:** each A-frame smear must cover 02's attack box; the preview overlays the box (08 §12.4).
4. **Icons that look alike at 16 × 16:** the 19 weapon icons and 17 ability icons must each be recognizable; a test checks that no two icons have the same silhouette mask.
5. **Font metrics off by one:** text would misalign everywhere. Tests check 07 §2.1's metrics exactly.
6. **Loud or harsh sounds:** loot sounds play a lot. Check peak levels and listen to the sheet.

---

### Task 1: Player full move set

**Files:** `tools/art/poses/player.py`, `tools/art/outfits.py`, `tools/tests/test_player_anims.py`

- [ ] **Tests first:**
  - every 08 §6.1 key exists for all 4 outfits with its frame count: `idle` 6, `run` 8, `skid` 1, `jump` 2, `apex` 1, `fall` 2, `double_jump` 4, `wall_jump` 2, `land` 2, `dash` 3, `wall_slide` 2, `ledge_climb` 4, `slide` 2, `crawl` 4, `dive_windup` 2, `dive_fall` 2, `dive_land` 2, `hurt` 2, `dead` 6, `drink` 4, `cart_ride` 2;
  - body, trim A and trim B have identical frame lists;
  - grounded anims have their lowest opaque row at 45;
  - `crawl` and `slide` fit inside the low box (01's crawl height) and `wall_slide` touches the wall side of the frame box;
  - the palette lock holds.
- [ ] **Draw the poses.** Give each move a clear silhouette:
  - jump: knees up, arms up; fall: legs down, arms out;
  - double jump: a tucked flip over 4 frames;
  - dash: body leaning hard forward, back leg stretched;
  - slide: low on one hip, feet first; crawl: on hands and knees;
  - wall slide: one hand and one foot on the wall, facing out;
  - ledge climb: hang, pull, knee up, stand;
  - dive: windup crouched in the air, fall straight down, land in a crouch with a fist or weapon down;
  - hurt: thrown back; dead: collapses over 6 frames;
  - drink: lifts a red flask (the sip frame is 2).
- [ ] **Look at** `player_<outfit>_sheet.png` and the GIFs for all 4 outfits. **Commit.**

### Task 2: Greatsword and War Maul

**Files:** `tools/art/weapons.py`, attack poses in `poses/player.py`, `tools/tests/test_weapons.py`

- [ ] **Tests first:**
  - atlases `weapon_greatsword` and `weapon_war_maul`, frames 160 × 96, anchor (80, 72);
  - keys `atk_greatsword_1..3` and `atk_war_maul_1..2`, 5 frames each, with body poses of the same names in every `player_<outfit>` atlas;
  - one `<key>_smear` per step;
  - `dive_<id>_windup`, `_fall`, `_land` (2 each);
  - each smear covers its 02 §10.2 attack box (at least 80% of the box's pixels).
- [ ] **Draw** per 08 §6.3 and §12.4:
  - Greatsword: a long steel blade with a gold guard; steps 1 and 2 are mirrored side swings; step 3 is a big overhead cleave.
  - War Maul: a heavy stone-and-iron head on a wooden haft; step 1 a sideways swing, step 2 an overhead smash into the ground.
- [ ] **Look at** the sheets with the hitbox overlays. **Commit.**

### Task 3: Stage 1 objects and tile decorations

**Files:** `tools/art/village.py` or a new `tools/art/objects.py`, `tools/art/tiles.py`, tests.

- [ ] **Arena door and timed door** (08 §8): 16 px wide, built from cap, middle and bottom tiles in `objects`. Arena door: heavy wooden portcullis with iron bands. Timed door: stone with **3 lamps** in three states (green pending, green open, red missed) as separate frames.
- [ ] **Guide arrow:** 16 × 16, 8 directions, a wooden sign arrow.
- [ ] **Plains decorations** (08 §9.1 rows 7–8): 8 top deco variants (grass tufts, flowers, small stones, mushrooms) and 8 hanging deco variants (roots, vines, moss). Water frames stay empty (no water in Plains).
- [ ] **Tests:** sizes, palette lock, the door pieces tile seamlessly when stacked, all 8 arrows are rotations of one shape.
- [ ] **Look at** the previews. **Commit.**

### Task 4: Loot items

**Files:** `tools/art/items.py`, `tools/tests/test_items.py`

All in atlas `items` (08 §8):

| Frame | Size | Look |
|---|---|---|
| `chest_timed_closed`, `_open` | 24 × 16 | `w_steel` box with a clock on the lid |
| `chest_cursed_closed`, `_open` | 24 × 16 | `fx_dark` box with a skull lock; the open frame shows a dark glow inside |
| `key` | 16 × 16 | `w_gold` key, a little tilted |
| `coin` | 8 × 8, `spin` 4 at 12 fps | `w_gold` coin turning |
| `blueprint` | 16 × 16 | a rolled blue scroll with a ribbon |
| `glow_weapon_<WeaponId>` × 19, `glow_ability_<AbilityId>` × 17 | 18 × 18 | #ffffff ring just outside each icon's silhouette (made from the icons of Task 5) |
| `beam` | 2 × 40 | #ffffff fading to transparent upward (code tints it with the grade color) |

(`lucky_block_idle` and `chest_key_*` exist from ART1. Redraw `glow_weapon_greatsword` the same way as the rest.)

- [ ] **Tests:** every frame and size; palette lock; each glow ring touches its icon's silhouette and covers no icon pixel.
- [ ] **Commit** after Task 5 (glows need the icons).

### Task 5: The `ui` atlas and fonts

**Files:** `tools/art/ui.py`, `tools/art/fonts.py`, `items.py` (icons), `tools/tests/test_ui.py`, `tools/tests/test_fonts.py`

- [ ] **`ui` atlas:** all **94 frames of 07 §3.4** with exactly 07's names and sizes, written to `public/assets/ui/ui.png` + `ui.json` (08 §12.5).
  - **Weapon icons (19):** each weapon at 45°, pointing up-right. Ability icons (17): one clear symbol each, in the ability's class colors (for example a slash for Blade Dash, a lightning bolt for Thunder Strike, falling arrows for Arrow Rain, a fang for Vampire).
  - Stat icons (12), class icons (4: sword, shield, bow, staff), element icons (5), status icons (4), Lucky Block and curse effect icons (16): ids from 05 and 02, looks per 08 §8.
  - `hud_*` frames and the tint frames (`class_*`, `prompt_ps_*`): #ffffff only for tint frames.
- [ ] **Fonts:** `rb_small`, `rb_small_plain`, `rb_large` per 08 §12.5 and 07 §2.1: 107 glyphs, 5 × 7 dot-matrix, metrics exact.
- [ ] **Tests:**
  - 08 §12.8 check 3 (all 94 frames with 07's sizes; all 107 glyphs in each font, with 07's `lineHeight`, digit width and advance, space advance, −1 offsets on outlined fonts);
  - palette lock (tint frames and fonts #ffffff and `ink` only);
  - no two weapon icons, and no two ability icons, have the same silhouette.
- [ ] **Look at** `ui_sheet.png` and a font sample that prints `RUSHBLADE 0123456789 1:52.47` in all three fonts. **Commit** Tasks 4 and 5 together.

### Task 6: Effects

**Files:** `tools/art/vfx.py`, `tools/tests/test_vfx.py`

Add to atlas `vfx` (08 §11; `hit_spark`, `hit_heavy`, `crit_spark`, `stun_stars`, `dust_jump`, `dust_land`, `muzzle`, `debris` exist):

| Group | Frames |
|---|---|
| Movement | `ring_djump`, `dust_walljump`, `dust_wall`, `dust_slide`, `dive_trail`, `dive_impact` (normal and heavy width), `dive_bounce`, `spike_spark` |
| Combat | `guard_spark`, `charge_glow`, `charge_full`, `explosion_s`, `explosion_l` |
| Flask, Rush, loot | `flask_orb`, `heal`, `rush_up`, `dash_refund`, `spawn_in`, `curse_wisps` |

- [ ] **Tests:** each id has 08's size and frame count; palette lock.
- [ ] **Look at** the GIFs. **Commit.**

### Task 7: Sounds

**Files:** `tools/audio/sfx_defs.py`, `tools/tests/test_sfx.py`

Add from 08 §13.3 (recipes, variant counts and volumes are there):
- movement: `ledge_grab`, `drop_through`, `spike_hit`;
- Rush: `rush_up`, `rush_max`, `rush_down`;
- charge: `charge_loop`, `charge_full`; blasts: `explosion_s`, `explosion_l`;
- Lucky Blocks: `lucky_hit`, `lucky_buff`, `lucky_debuff`, `jackpot`;
- chests and curses: `chest_open`, `chest_locked`, `cursed_open`, `curse_lifted`;
- pickups: `key_pickup`, `keys_full`, `coin`, `item_pop`, `pickup_weapon`, `pickup_ability`, `blueprint`;
- shop: `purchase`, `cant_afford`, `upgrade`, `sell`, `reroll`;
- run: `split_faster`, `split_slower`, `pb`, `sleep`, `restart`;
- menus: `ui_move`, `ui_confirm`, `ui_back`, `ui_error`, `ui_open`, `ui_close`, `ui_toggle`.

- [ ] **Tests:** every id and variant exists; length and peak level within 08 §13.1's limits; two builds give identical bytes.
- [ ] **Update** `docs/art/sounds_stage1.md` and the listening sheet `.wav` with the new sounds. **Commit.**

### Task 8: Boards, checks, hand-off

- [ ] **Movement sheet** `tools/out/preview/player_moves_board.png`: all 4 outfits in every move, one row per move, at 3×, on the Plains mid-ground color, labelled.
- [ ] **Loot and HUD board** `tools/out/preview/style_board_loot.png`: a 640 × 360 Plains scene at 2× with:
  - every chest closed and open, a Lucky Block, a key, coins, a blueprint;
  - a ground weapon of each grade (with glows and the A/S beam) and two ground abilities;
  - the arena door and timed door (all 3 lamp states), guide arrows, the new deco tiles;
  - a mock HUD in 07 §4.1 positions using the `ui` frames and fonts: HP, flask, Rush, gold, keys, two weapon slots, two ability slots, class name, timer;
  - the player mid-dash with the Greatsword and mid-smash with the War Maul.
- [ ] **Run** `npm run assets`, all `tools/tests`, `npm run test:e2e`. Two builds give identical bytes.
- [ ] **Copy** both boards to `docs/art/` (`player_moves_v1.png`, `style_board_loot_v1.png`). Commit and push to `main`.
- [ ] **Hand-off:** show the user both boards and play them the listening sheet.
  - Ask:
    - Do the moves read clearly (jump, dash, slide, wall slide)?
    - Can you tell every icon apart?
    - Is the text easy to read?
    - Any sound annoying?
  - On approval, copy the boards to `tools/approved/` and log them.
  - Tell the user: "The code chat wires these in with M4 (player moves, weapons, HUD) and M5 (loot)."

## Done when

Both boards are approved (or changes are listed), all checks pass, and `main` is green.

**Next art plan:** `ART5-classes-weapons-abilities.md` (the 6 new starting weapons, player projectiles, ability poses, ability effects and sounds for M4).
