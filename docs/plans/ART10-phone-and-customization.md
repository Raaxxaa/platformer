# ART10: Phone Controls Art and Character Customization Art — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two parts, in this order:
- **Part A (for M12, small):** touch button art and the app icons for the installable phone version.
- **Part B (for M13, big):** the player rebuilt as **colorable layers** (4 races, 8 hair styles, 5 beards, 4 faces, 4 outfits), **35 accessories** from enemies, **24 shop cosmetics**, their icons, and the wardrobe's look.

**Architecture:** The ART1–ART9 pipeline. Part B reworks `tools/art/outfits.py` and the rig into layer outputs; accessories in a new `tools/art/cosmetics.py`.

**Spec:** Part A: `docs/spec/07-ui-hud-controls.md` §8.6 (touch controls: buttons, icons, sizes). Part B: `docs/spec/09-customization.md` (all, especially §2 options, §3 and §5 item lists, §7 layers and attachment points), `08-art-audio.md` §4.1–4.2 (frames and composition), §6 (player anims, which every layer must cover), §12.3 (rig), §12.5 (atlases, `anims.json`).

**Starting point:** ART9 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints

- All earlier art constraints hold: palette lock, outlines, determinism, untrimmed frames, previews read with the Read tool, **never break `main`** (if the game can't use a new layer yet, keep the old atlases working beside it and log it in `docs/art/SPEC-GAPS-art.md`).
- Only touch `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`.
- **Same frames for every race and look** (09 §1): same frame list, same anchors, same feet row; nothing outside the 48 × 48 frame except capes behind (≤ 8 px).
- **Grey-ramp layers** (skin, cloth A, cloth B, hair, beard) use exactly 4 fixed greys so the game's multiply tint gives clean 4-shade colors. Add the 4 greys and all skin, hair and dye colors (09 §2, §5) to the palette.

## Review Focus

1. **Alignment:** hair, beard, hats and capes on every frame of every anim (the board shows all of them).
2. **Readability:** every race and color combination stays readable against every biome (contrast report: the darkest and lightest skins and dyes).
3. **Touch buttons too busy:** they must read at 55% opacity over a busy fight.

---

## Part A — phone

### Task 1: Touch button art and app icons
- [ ] `ui` atlas frames (07 §3.4, the "Touch" row): `touch_ring` (64 × 64 circle ring, tint), `touch_fill` (64 × 64 disc, tint), `touch_jump`, `touch_dash`, `touch_heal`, `touch_interact`, `touch_pause` (24 × 24 icons, white, tint), `touch_stick_base` (96 × 96), `touch_knob` (40 × 40), `rotate_phone` (64 × 48, for the turn-sideways screen). Weapons and abilities reuse their existing icons.
- [ ] **App icons:** `public/assets/app/icon-192.png`, `icon-512.png` (the RUSHBLADE logo: a slashing blade over a dash streak on `#0d0b14`, safe for Android's round mask), `apple-touch-icon.png` (180 × 180), `favicon.png` (32 × 32).
- [ ] **Mock** `tools/out/preview/touch_mock.png`: the 844 × 390 phone layout from 07 §8.6 over a Stage 1 scene. **Show the user.** Commit, push to `main`.

## Part B — customization

### Task 2: Attachment points and the layer rig
- [ ] The rig exports, for every player frame, the points `head`, `back`, `neck`, `shoulder` (frame px) into `anims.json` (one entry per frame). The game uses them to place accessories.
- [ ] Split the player into the 09 §7 layers: `skin_<race>`, `outfitA_<outfit>`, `outfitB_<outfit>`, `fixed_<race>_<outfit>`, the existing trims per outfit, `hair_<style>` and `hair_<style>_hat`, `beard_<style>`, `headwear_<outfit>` (plate helmet, robe hat), `face_<n>` (or merged into `fixed` per face). Same frame names in every layer atlas.
- [ ] **Tests:** every layer atlas has the full player frame list; feet row 45; grey layers use only the 4 greys; trims unchanged.
- [ ] **Look, commit.**

### Task 3: Races, hair, beards, faces, outfits
- [ ] Draw the 4 races (09 §2: elf ears, dwarf build inside the same box, orc tusks), 8 hair styles (+ under-hat variants), 5 beards, 4 faces, and the 4 outfits as cloth A / cloth B / fixed parts.
- [ ] **Board** `tools/out/preview/style_board_looks.png`: all 4 races × 4 outfits in idle with sample colors; a row of each hair style and beard; one character in run, jump, dash, attack and death. **Show the user; wait for approval.** **Commit.**

### Task 4: The 35 accessories
- [ ] One per row of 09 §3, in its slot: head items fit the `head` point (with or without hair), back items behind the body (capes: `idle`, `run`, `air` frames), extras on `neck`/`shoulder` (floating ones with a 2-frame bob). Themed after their enemy and drawn with the enemy's ramps.
- [ ] Each gets a 16 × 16 icon `icon_cos_<id>` in the `ui` atlas and a silhouette version for the collection (or the code darkens the icon; note which).
- [ ] **Board** `style_board_accessories.png`: a grid of all 35 worn by a human in idle, plus 6 on other races. **Show the user.** **Commit.**

### Task 5: The 24 shop cosmetics and the wardrobe look
- [ ] Hats and capes of 09 §5 (worn art + icons), dye and hair-dye icons (a bottle in the color).
- [ ] Wardrobe art: a mirror-frame panel border for the wardrobe screen (popup skin variant), tab icons for Body / Clothes / Accessories / Collection, the `shop_cosmetic` stand prop (a dress form with a cloth) for tile 38, and the mirror prop updated with glass and a glint.
- [ ] Contrast report lines for the extreme skins and dyes on every biome.
- [ ] Run `npm run assets`, all `tools/tests`, `npm run test:e2e`; push to `main`.
- [ ] **Hand-off:** show the user the boards. On approval, copy them to `tools/approved/` and log them.
