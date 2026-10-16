# ART3: Home Village and Crossroads Village Art — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Art for the two villages the player visits first: the **Home Village** (dawn, where every run starts) and the **Crossroads Village** (sunset, after Stage 1). That means:
- village backgrounds and buildings;
- every interactable prop;
- the village NPCs (shopkeeper, innkeeper, merchant);
- the training dummy.

Everything is composed into a **village style board** for the user to approve.

**Architecture:** Extend the ART1/ART2 pipeline:
- `tools/art/village.py` for buildings and props;
- `tools/art/npcs.py` for NPCs, reusing the humanoid rig with the `npc` ramp;
- backgrounds added to `tools/art/backgrounds.py`;
- `tools/art/style_board.py` gains a village board.

Atlas and frame names follow 08 so the code chat can use them later without changes.

**Tech Stack:** Python 3, Pillow, numpy, `unittest`.

**Spec:**
- `docs/spec/08-art-audio.md`: §3.2 (`npc` ramp), §3.7 (`village_home` and `village_crossroads`: `vl_wood`, `vl_plaster`, `vl_light`, dawn and sunset skies, plains layers), §4.1 (NPC 48 × 48, anchor (24, 46); statues 32 × 48), §8 (items/objects table: merchant, village NPCs, class statues, inn, shop stall, altars, boards, gate, loot stand, dummy), §10.1 (parallax), §12.7 (style boards and approval).
- `docs/spec/06-run-levels-save.md` §12 (village layouts: 48 × 23 tiles, floor at row 20, and the tile x of every object). Draw props to fit those spots.
- `docs/GAME_PLAN.md` 9.1 (villages are "cozy and calm": warm lights, a break between stages) and 4.5 (the character mirror comes later; leave a spot for it, no art yet).

## Global Constraints

- All ART1/ART2 constraints still hold: palette lock, outline rules, determinism, frames not trimmed, previews checked with the Read tool.
- Villages use `pl_*` terrain (the Plains tileset already exists), plus `vl_wood`, `vl_plaster`, `vl_light`, `npc`, `gray`, `w_*` (08 §3.7).
- Props sit on the floor at the tile x given in 06 §12, and must not hide the player (no foreground deco, 08 §2).
- Interactable props must be **easy to tell apart at 1×**: the shop items, altars, flask, refill, key and reroll each get a distinct shape and color.
- Only touch `tools/`, `public/assets/`, `docs/art/`.

## Review Focus

1. **Props too similar to each other:** the player must instantly see "this is the inn, this is the flask upgrade". Check the board, and ask the user.
2. **Props don't match the layout spots:** a test checks each prop's width against the free space between its neighbors at the 06 §12 tile x positions (no overlap).
3. **Village too busy to read the player:** the contrast report covers the player and NPCs against both village backgrounds.
4. **Warm lights flicker too much:** light glows animate gently (≤ 2 Hz alpha change, 08 photosensitivity rule).
5. **Non-determinism:** the determinism test covers the new outputs.

---

### Task 1: Village backgrounds and buildings

**Files:** `tools/art/backgrounds.py` (add `bg_village_home_0/1/2` and `bg_village_crossroads_0/1/2`), `tools/art/village.py`, `tools/tests/test_village_bg.py`

- **Backgrounds**, 640 × 360, seamless left to right:
  - **Home Village (dawn):** sky #f2b48a → #fbe6c8. Far hills, then cottage rooftops with chimney smoke, then near fences and trees.
  - **Crossroads (sunset):** sky #e0785a → #f6c890. Far hills with two roads forking into the distance (one toward mountains, one toward a dark forest; this hints at the route choice), then a market street, then near lanterns.
- **Building props** (`objects` atlas, depth 30), drawn as backdrops behind the play area:
  - Home Village: 2 cottages and a well.
  - Crossroads: a market stall roof over the shop row (spanning tiles 7–37), and the **inn**: a 2-storey timber house with a sign and warm windows. The door covers tiles 41–43, rows 16–19.
- **Test:** palette lock, seamless backgrounds (same method as ART1), and the inn door rect matches 06 §12.2.
- **Look at** the previews. **Commit.**

### Task 2: Interactable props

**Files:** `tools/art/village.py`, `tools/tests/test_village_props.py`

Produces `objects` atlas frames. Sizes are in px; the bottom of each prop sits on the floor:

| Prop (06 id) | Look | Size | Anim |
|---|---|---|---|
| `shop_item` | Wooden pedestal with a cloth; the item floats above it (the item comes from code) | 24 × 16 | — |
| `ability_altar` | Small stone altar with a rune; glows in a tintable white (code tints it with the class color) | 24 × 24 | `idle` 2 at 1 fps (glow) |
| `shop_flask` | A big red potion bottle on a stand | 16 × 24 | — |
| `shop_refill` | A bubbling cauldron | 24 × 20 | `idle` 4 at 6 fps |
| `shop_key` | A key hanging on a hook board | 16 × 24 | — |
| `shop_reroll` | A dice cup on a barrel | 16 × 24 | — |
| `class_statue` × 4 | Swordsman (sword raised), Tank (hammer and shield), Archer (drawn bow), Wizard (staff and hat), in `gray` stone with `w_gold` details | 32 × 48 each | — |
| `unlocks_board` | Notice board with pinned papers | 32 × 32 | — |
| `seed_board` | Small chalkboard with a dice symbol | 24 × 32 | — |
| `gate` (Home exit) | Wooden village gate with a lantern | 32 × 64 | lantern 2 at 2 fps |
| `training_dummy` | Straw dummy on a post (`vl_wood`, `gray`), in atlas `enemies_extra` per 08 §7.3 | 48 × 48, anchor (24, 46) | `idle` 1, `hit` 3 at 20 fps |
| `loot_stand` | `gray` pedestal (08 §8) | 16 × 16 | — |
| `mirror_spot` | Placeholder spot for the future character mirror (GAME_PLAN 4.5): an empty wooden frame | 24 × 40 | — |

- **Tests:**
  - every frame exists with its size;
  - the palette lock holds;
  - placed at the 06 §12.2 and §12.3 tile x positions, no two props overlap;
  - the props differ (no two props have the same silhouette mask).
- **Look at** the sheet. **Commit.**

### Task 3: Village NPCs

**Files:** `tools/art/npcs.py`, `tools/tests/test_npcs.py`

- Atlas `npcs`: `shopkeeper` (apron, mustache), `innkeeper` (round, holding a mug), `merchant` (the wandering merchant, big backpack, hooded: 06 §11.3), `villager_a`, `villager_b` (Home Village ambience).
- All 48 × 48 with anchor (24, 46), using the humanoid rig with `npc` + `skin` + `hair` + `vl_*`. Each has `idle` (4 frames at 6 fps); the shopkeeper and innkeeper also have `wave` (4).
- NPCs are decoration: they stand behind the props. The code chat will place them (shopkeeper behind the shop row, innkeeper at the inn door, villagers in the Home Village).
- **Tests:** frames and sizes, palette lock, and NPC colors differ from the player outfits' `p_*` ramps.
- **Look at** the GIFs. **Commit.**

### Task 4: Village style board, contrast, hand-off

**Files:** `tools/art/style_board.py` (add `style_board_villages`), `tools/art/contrast.py` (add village lines)

- **Board:** two 640 × 360 scenes (Home Village and Crossroads) at 2×, stacked vertically, written to `tools/out/preview/style_board_villages.png`. Every prop sits at its 06 §12 tile x on the Plains floor, with the NPCs, the player (starter look) standing near the statues or the shop, and a ground weapon on a `shop_item` pedestal.
- **Contrast report:** add lines for the player and NPCs against both village backgrounds. No FAIL.
- **Run** `npm run assets` and all `tools/tests`. Two builds give identical bytes.
- **Copy** the board to `docs/art/style_board_villages_v1.png`. Commit and push to `main`.
- **Hand-off:** show the user the board.
  - Ask:
    - Do the villages feel cozy and calm?
    - Can you tell every shop object apart?
    - Anything to change?
  - On approval, copy the board to `tools/approved/` and log it.

## Done when

The village board is approved (or changes are listed), and all checks pass.
