# M13: Character Customization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players make their own hero, separate from their class:
- a **wardrobe** at the Home Village mirror: race (Human, Elf, Dwarf, Orc), skin, face, hair, hair color, beard, outfit, two cloth colors, and three accessory slots (head, back, extra);
- **35 accessories**, one from each enemy type, unlocked the **first time** you kill it, kept forever;
- **1 shop-only cosmetic** per village shop visit (dyes, hats, capes), bought with run gold;
- a **collection book** with silhouettes and hints for what's missing.

Looks only: no stats, same hitbox for everyone, the class still shows as a colored trim.

**Spec:** `docs/spec/09-customization.md` (new, all of it). Also `docs/GAME_PLAN.md` §4.5, `docs/spec/06-run-levels-save.md` §12.2 (`shop_cosmetic` at tile 38), §12.3 (`mirror_spot` opens the wardrobe), §15 (save), `05-loot-economy.md` §10 (shop stream: the cosmetic draw comes **after** the key draw), `07-ui-hud-controls.md` §6 (popup skin, toasts), §7.5 (records gets a `LOOKS` tab), §8.6 (touch: the wardrobe must work by tap), `08-art-audio.md` §4.2 (layers, extended by 09 §7).

**Starting point:** M12 on `main`, and **ART10 Part B** on `main` (the layered player art, accessories and icons). Until ART10 lands, build everything with placeholder layers (grey boxes per layer, accessory icons as colored squares) so the logic and UI are done and tested; swap the art in when it arrives. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Global Constraints

- All earlier constraints hold. **The simulation never reads the look**: determinism tests must pass with any look (09 test 1).
- **Shop seeds stay stable:** existing shop stock and keys for a given seed must not change (09 test 4).
- The wardrobe's **Random** button is the only randomness, and it lives in the UI layer (never the core RNG streams).
- Every player view in the game uses the same look: world, class pick preview, run summary, death screen, wardrobe preview.

## Review Focus

1. **Seed drift in shops** from the new cosmetic draw (09 §5, test 4).
2. **Layer alignment:** hair, beard, hats and capes must sit right on every frame of every anim (attachment points from `anims.json`). Pinned by screenshots of all 4 races in several anims.
3. **Save safety:** old saves load with the default look; unknown or unowned options fall back (09 test 6).
4. **Performance:** up to 12 player sprites instead of 5; check the frame time on the emulated phone (M12 Low effects) stays as before.

---

### Task 1: Cosmetics data and unlock rules (core)
**Files:** `src/data/cosmetics.ts`, `src/core/cosmetics/unlocks.ts`, tests.
- [ ] **Tests:** 09 checklist 2, 3, 8 (the `seenEnemies` part); unlocks happen on player kills only (02 §3.4), summons count, dummies don't; the Dragon unlocks per color; `cosmeticUnlocked` events.
- [ ] **Implement** 09 §3–§4. **Commit.**

### Task 2: Save data
- [ ] `look` and `cosmetics` in `SaveData` (09 §8) with defaults, validation and fallback (09 test 6). Written at once on unlock and on Confirm.
- [ ] **Commit.**

### Task 3: The shop cosmetic slot
**Files:** `src/core/economy/shop.ts` (extend), `levels-src/village_*` (add `shop_cosmetic` at tile 38), tests.
- [ ] **Tests:** 09 checklist 4 and 5; Haggler price; `Collection complete` when everything is owned; buying adds to `owned` with a toast and does not drop an item.
- [ ] **Commit.**

### Task 4: Layered player drawing
**Files:** `src/game/view/PlayerLook.ts`, `EntitySprites.ts` (player part), tests for the pure parts (layer list, tint colors, hat rules).
- [ ] Draw the 09 §7 layers in order with the multiply tints; accessories on the per-frame attachment points from `anims.json`; hats hide the outfit headwear and switch hair to its under-hat variant (09 test 7); capes pick `idle`/`run`/`air` frames by movement state; overlay flashes cover every layer.
- [ ] Use the look everywhere the player appears (Global Constraints).
- [ ] **Commit.**

### Task 5: The wardrobe and the collection
**Files:** `src/ui/wardrobe/` (model + view), the Home Village mirror, records `LOOKS` tab.
- [ ] Interacting with the mirror opens the wardrobe (09 §6): live preview with idle/run/jump/attack, tabs Body / Clothes / Accessories / Collection, Random, Undo changes, Confirm. Works with keyboard, gamepad **and touch** (taps on rows and tabs, 07 §8.6).
- [ ] First launch opens it once before the first class pick ("Make your hero").
- [ ] Collection grid with silhouettes, `???`, hints and the `n / 59` counter; the same grid read-only in records.
- [ ] **Tests:** the wardrobe model (cycling skips locked options, Undo restores, Confirm saves), the collection hint rules.
- [ ] **Commit.**

### Task 6: E2E and hand-off
- [ ] **E2E** `tests/e2e/wardrobe.spec.ts`: first launch shows "Make your hero"; change race, hair and colors and confirm; the look persists after a reload; kill a Wolf (debug helpers) and see the toast and the hood in the Accessories tab; wear it and screenshot in Stage 1; buy a shop cosmetic in the Crossroads; the collection counter. Also on the emulated phone (M12).
- [ ] **Screenshots** of all 4 races × 4 outfits in idle, and a few in run, jump, dash and an attack, with a hat and a cape. **Read them** (look for misaligned hair, hats and capes).
- [ ] **Run everything; push to `main`.**
- [ ] **Hand-off:** "Visit the mirror in the Home Village to make your hero: race, hair, clothes and colors. Every enemy type drops a cosmetic the first time you beat it, and each village shop sells one shop-only cosmetic. Looks only, no stats." Send the screenshots. Ask: are there enough options? Which accessories look best or worst? Is the wardrobe easy to use on a phone?

## Done when
All tasks are checked, all checks pass (including 09's checklist), and the user has made a character and collected a few accessories.
