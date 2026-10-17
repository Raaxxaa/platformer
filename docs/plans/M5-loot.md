# M5: Loot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Stage 1's grey loot markers real, so every run gives different gear:
- **weapon grades** F, C, B, A, S, with **elements** (fire, ice, lightning, poison, wind), **A-grade perks** and **S-grade signature moves**;
- **free loot stands**, **key chests** (pick 1 of 2), the **cursed chest** (great loot, but one hit kills you for 10 kills), the **timed chest** behind the timed door;
- **keys**, **Lucky Blocks** (7 buffs, 7 debuffs), **gold** from kills and chests;
- **elite drops** (keys and abilities), the **Great Boar's weapon drop**;
- the **wandering merchant** (buy items, upgrade abilities).

**Architecture:**
- `src/core/loot/`: rolls, item building, chests, Lucky Blocks, curses, merchant (pure, seeded with `deriveSeed`; one generator per source, 05 §2.1).
- `src/core/combat/elements.ts`: grows from Lightning-only to all 5 elements.
- `src/core/combat/signatures.ts`: S-grade moves.
- `src/data/loot.ts` (odds, perks, names, Lucky Block, curses, Ambush packs) and `src/data/economy.ts` (prices, chest gold).
- View: chest, key, coin, Lucky Block, glow and beam sprites (ART4), element and signature effects (ART6), item cards with grades, effect boxes, curse counter, merchant.

**Tech Stack:** As before.

**Spec:**
- `docs/spec/05-loot-economy.md`: everything except §10–11 shop parts that need a village, §13 stat upgrades and §14 blueprints (both M7, they need the stat pick screen and save data). The merchant (§12) **is** in M5.
- `docs/spec/02-combat.md` §6 (all elements, immunities), §13 (signatures, for the 8 built weapons).
- `docs/spec/04-enemies-bosses.md` §2 (elite drops, gold), §10.1 (Great Boar loot).
- `docs/spec/06-run-levels-save.md` §8.4 (objects), §11 (interact, ground items, merchant layout).
- `docs/spec/07-ui-hud-controls.md` §4.6 (gold, keys, Lockpick), §4.7 (effects row), §5.6 (item badges), §6.1 (item card with grades), §6.4 (merchant price tags), §6.8–6.10 (banners, alerts, toasts), §9.3 (Lucky Block lines).

**Starting point:** M4.1 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Scope

**In M5:** everything in the Goal. Gold is shown on the HUD and carried through the run (spent at the merchant now, at village shops in M7).

**Loot pool for now:** only items that exist in the game can drop: the **8 weapons** (Greatsword, War Maul, Katana, Iron Fists, Bow, Crossbow, Storm Hammer, Staff) and the **9 abilities** of M4. The 05 rules work on "the pool", so use `pool = unlocked ∩ implemented`. When M9 adds the rest, they join automatically. Mark it `// SPEC-GAP: pool limited to implemented items until M9` once; it is the design chat's choice, so it doesn't go in `SPEC-GAPS.md`.

**Later:** village shop, selling, flask upgrades, reroll (M7); stat upgrades after a boss (M7); blueprints and unlocks (M7, need save data); `EXTRA_CURSES` stays off.

## Global Constraints

- All earlier constraints hold.
- **Every roll is seeded per source** (05 §2.1). Opening chests in a different order never changes their contents. A test proves it.
- **Every weapon roll makes exactly 5 draws** (05 §4.1), even when some are unused.
- Odds tables are data, never computed at runtime; a test re-derives the Stage 2–4 rows (05 checklist 2).
- The Training Yard gets its loot corner (`docs/levels/training-yard.md` "Later"): a Lucky Block, a key and a key chest, with signs. Yard loot is practice only and is removed when you leave.

## Review Focus

1. **Seed stability:** same seed + same carried abilities = same items, whatever the order (05 checklist 9).
2. **Draw count drift:** an extra or missing `rng()` call shifts every later roll. Pinned by 05 checklist 7.
3. **Cursed chest fairness:** one-hit means *every* damage source, but Second Wind still saves you once (05 §8, checklist 16–17).
4. **Element stacking bugs:** Burn, Chill/Freeze, Poison stacks and their timers, and immunities (02 §6.7).
5. **Gold rounding:** integer tenths, round half up (05 §9.3, checklist 18).

---

### Task 1: Loot data and the weighted pick

**Files:** `src/data/loot.ts`, `src/data/economy.ts`, `src/core/loot/pick.ts`, tests.

- [ ] **Tests:** 05 checklist 1, 2, 3; perk table, name tables, Lucky Block table, curse table and Ambush packs match 05 exactly.
- [ ] **Implement.** **Commit.**

### Task 2: Building items

**Files:** `src/core/loot/rollWeapon.ts`, `rollAbility.ts`, `names.ts`, tests.

- [ ] **Tests:** 05 checklist 5 (Dragon and Black Knight tables only as pure rolls), 6 (class lean, run against the implemented pool: with one Swordsman ability, Swordsman weapons ≈ 0.35 + 0.65 × 2/8), 7, 8, 28; a C starting weapon makes no draws (05 §4.7).
- [ ] **Implement** 05 §4.1–4.6. **Commit.**

### Task 3: All elements

**Files:** `src/core/combat/elements.ts` + tests.

- [ ] **Tests:** 02 checklist 20 (Burn), 21 (Ice, Freeze, shatter, immunity), 22 (Lightning, already passing), 23 (Poison), 24 (Wind refunds the dash on kills); element level from grade (B 1, A 2, S 3); immunities (02 §6.7); Storm Caller's bonus applies to every element.
- [ ] **Implement** 02 §6.1–6.7. Weapon hits carry their weapon's element; ability hits never do (03 §7.8), except Firestarter's Burn (05 §7.2).
- [ ] **Commit.**

### Task 4: Perks and S-grade signatures

**Files:** `src/core/loot/perks.ts`, `src/core/combat/signatures.ts`, tests.

- [ ] **Perks** (05 §4.4): Quick, Keen, Brutal, Finisher, Leeching (with `leechBank`), Fleet, Sturdy, Greedy. One test each, plus two Fleet weapons = +16% and two Sturdy = ×0.81.
- [ ] **Signatures** (02 §13) for the 8 built weapons: Greatsword Ground Wave, Katana Phantom Edge, War Maul Quake, and Iron Fists, Bow, Crossbow, Storm Hammer and Staff as listed in 02 §13. One test each with the exact numbers.
- [ ] **Commit.**

### Task 5: Ground items, keys and gold

**Files:** `src/core/loot/groundItems.ts`, `src/core/economy/gold.ts`, tests.

- [ ] **Tests:** 05 checklist 11 (key cap), 18 (kill gold), 19 (Leaky Pockets coins); ground items fall and rest (05 §5.7) and never despawn in the stage; keys and coins are collected by touch; everything is cleared at stage end and death; gold resets at death.
- [ ] **Implement.** Gold is credited instantly on kills (05 §9.3) with 08's cosmetic `coin_trail` to the HUD. **Commit.**

### Task 6: Free loot, chests and the boss drop

**Files:** `src/core/loot/sources.ts` + tests; Stage 1 objects stop being grey markers.

- [ ] **Tests:** 05 checklist 9, 10 (including the Thief Lockpick before a key, calling M4's `tryLockpick()`); a free loot stand rolls at stage load with the abilities carried then; the cursed chest gives 100 gold, a cursed-table weapon and `one_hit` for 10 kills (05 checklist 17); the timed chest gives 80 gold and a key-table weapon; the Great Boar drops a key-table weapon at its death point (remove M3's `SPEC-GAP: boss weapon drop`).
- [ ] **Elite drops** (04 §2): rolled at stage load on `enemyDrops`; 04 checklist 23.
- [ ] **Commit.**

### Task 7: Lucky Blocks and curses

**Files:** `src/core/loot/lucky.ts`, `src/core/loot/curse.ts`, tests.

- [ ] **Tests:** 05 checklist 12–17 and 29; 02 checklist 35; Ambush spawns `wolf, wolf, bandit` at the 05 §7.5 offsets with spawn-in; Butterfingers locks slot 2 as described.
- [ ] **Implement** 05 §7–8. Lucky Blocks break only on weapon direct hits (dives and the thrown hammer count).
- [ ] **Commit.**

### Task 8: Wandering merchant

**Files:** `src/core/loot/merchant.ts` + tests, view.

- [ ] **Tests:** present 40% of the time per seed at stage load (05 §12); stock = 2 cursed-table weapons with different ids + 1 ability; prices ×1.25 rounded to 5 (05 checklist 22 merchant part); ability upgrades at normal prices through `merchant_altar` (06 §11.3: +1 level, `MAX` at Lv5, charge state kept, a Lv5 upgrade of Blink or Blade Dash adds a ready charge); buying goes through the pickup and swap rules and takes gold only when the item is taken.
- [ ] **View:** the merchant NPC (ART3), item pedestals with price tags (07 §6.4), `SOLD`.
- [ ] **Commit.**

### Task 9: View and HUD

- [ ] **Sprites** (ART4): Lucky Block, key/timed/cursed chests (closed/open), keys, coins, ground items with grade-colored glow and the A/S beam, loot stands with their floating item, item badges (07 §5.6).
- [ ] **Effects** (ART6 where on `main`, else simple shapes): element hit effects and status visuals (burn flames, chill frost, freeze ice block, shatter, chain line, poison bubbles, wind gusts), S signature effects, `curse_wisps`, the Lucky Block break.
- [ ] **HUD:** gold and keys (07 §4.6), the Lockpick icon for Thief, the effects row with timers and the curse counter (07 §4.7), Lucky Block banners (07 §6.8, §9.3), `Keys full`, `Curse lifted`.
- [ ] **Item card** shows grade color, element, perk and `DMG` with the ± compare (07 §6.1).
- [ ] **Sounds** from ART4 and ART6 (chests, keys, coins, pickups, Lucky Block, curse, element hits).
- [ ] **Commit.**

### Task 10: E2E, determinism, hand-off

- [ ] **E2E** `tests/e2e/loot.spec.ts`: open each chest type and screenshot; break a Lucky Block with a forced buff and a forced debuff (debug helper `forceLucky(id)`); pick up a weapon of each grade and screenshot the item card; buy from the merchant (debug `forceMerchant()`); the cursed chest one-hit rule; the boss drop.
- [ ] **Determinism:** the same seed and inputs give the same items in two runs.
- [ ] **Run everything; read every screenshot; push to `main`.**
- [ ] **Hand-off:** tell the user: "Stage 1 now has real loot: chests, keys, Lucky Blocks, graded weapons with elements, the cursed chest, the merchant, and the boss drop. Every run gives different gear." Ask:
  - Does finding gear feel exciting?
  - Is the cursed chest worth the risk?
  - Are Lucky Block debuffs too punishing?
  - Do you end Stage 1 with roughly 400–600 gold?

## Done when

- All tasks are checked and all checks pass.
- Spec checklist items with passing tests: **05:** 1–3, 5–19, 22 (merchant part), 28, 29. **02:** 20–24, 35. **04:** 23.
- The user has played a few runs with loot and given feedback.

**Next plan:** M7 (villages: Home Village, Crossroads, shop, inn, stat upgrades, saving), then Stage 2.
