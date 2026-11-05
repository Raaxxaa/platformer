# M15: Smash-Style Moves, Daily Challenge, Boss Rush — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. **New moves for every weapon** (the user asked for "like Smash, but upwards"): a ground **Launcher** (Up + attack), an **up air attack** with a small hop, **juggles** (keep launched enemies in the air, +10% per juggle hit up to +40%), and a **dash attack** for melee weapons. Ranged weapons shoot straight up.
2. **Daily challenge:** the same seed, kit and layout for everyone each day, with a share text.
3. **Boss rush:** all bosses back to back against the clock, unlocked after beating the Enemy King.

**Spec:** `docs/spec/02-combat.md` **§9.6a** (new moves), §4.4 (Launch), §8.2 (Rush), §9.3 (move caps), §11 (Storm Hammer throw keeps Up + button); `docs/spec/06-run-levels-save.md` **§14.1** (daily), **§14.2** (boss rush), §7 (seeds), §5.3–5.4 (no PBs from seeded or assisted runs); `07-ui-hud-controls.md` §7 (title, result screens), §8.6 (touch: stick up + attack); `09-customization.md` §3 (daily counts for accessories, boss rush doesn't).

**Art is on hold** until the user picks a new style: use placeholders (reused frames or simple shapes) for everything new, and don't wait for ART plans.

**Starting point:** M14 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first. ART11 draws the new poses; until it lands, reuse each weapon's step-1 frames (rotated 90° up for the up moves is fine as a placeholder).

## Global Constraints

- All earlier constraints hold. Every number is in 02 §9.6a or 06 §14.1–14.2.
- **Nothing old changes:** existing combos, the Storm Hammer throw (Up + button when ready), the Spear lunge, the Katana charged dash-slash, dive slams (Down + button in the air) all work exactly as before; their tests stay green.
- Determinism: daily and boss-rush runs are reproducible from their seed and inputs.

## Review Focus

1. **Input conflicts:** Up + attack vs the hammer throw; Down + attack in the air vs the dive; attack during a dash vs the Spear lunge and the Katana charge. Pinned in Task 1.
2. **Infinite juggles:** the 4-juggle cap; bosses never juggled. Pinned in Task 2.
3. **Daily fairness:** the same UTC day gives the same seed, kit, layout and Dragon roll on every device. Pinned in Task 4.

---

## Part A — the moves

### Task 1: Launcher, up air attack, dash attack (core)
**Files:** `src/core/combat/playerCombat.ts` (move selection), `src/data/weapons.ts` (derived steps from step 1 and weight), tests.
- [ ] **Tests first:**
  - every melee weapon's Launcher, up air attack and Rushing Strike numbers derive from its step 1 and weight exactly as the 02 §9.6a tables (one test per weight with the Greatsword/Katana/War Maul);
  - the Launcher Launches a Wolf (small) and a Bandit (medium), not a Brute (large: knockback only), never a boss;
  - the up air hop happens once per airtime and shares the flag with the Iron Fists uppercut;
  - Up + Storm Hammer with the throw ready throws; not ready, it's the Launcher;
  - Down + button in the air is still a dive; Up + button in the air is the up air attack;
  - attack during a dash: Spear → lunge (unchanged); Katana tap → Rushing Strike, Katana hold → charged dash-slash (unchanged); Greatsword → Rushing Strike; Shield → unchanged; ranged → normal shot;
  - ranged weapons fire straight up with Up; the Spell Tome blast is placed above;
  - Rushing Strike gives the Rush `dashAttack` bonus.
- [ ] **Implement. Commit.**

### Task 2: Juggles
- [ ] **Tests:** a launched small enemy hit again in the air gets `vy ≤ −160` and its `juggleCount` goes up; juggle hits get +0.10 each in the additive pool, capped at +0.40; after the 4th juggle hit it falls; `juggleCount` resets on landing; bosses and large enemies are never juggled.
- [ ] **Implement. Commit.**

### Task 3: View, sounds, training
- [ ] Draw the moves with ART11's poses and smears (`atk_<weapon>_up`, `atk_<weapon>_upair`, `atk_<weapon>_dash`, 08 key style) or the placeholder until it lands; a small "JUGGLE ×n" number above the juggled enemy (07 damage-number style, `highlight` color).
- [ ] **Training Yard:** add station **18 "Launch and juggle"** after station 14: a straw target on the ground; done when you launch it and hit it twice more in the air. Sign: `↑ + Attack — launch, then jump and keep hitting`. Add station **19 "Dash attack"**: done when a Rushing Strike hits a straw target. Update `docs/levels/training-yard.md` and the checklist board (now 19 stations).
- [ ] Touch: stick up + Attack works (07 §8.6); test on the emulated phone.
- [ ] **Commit.**

## Part B — the modes

### Task 4: Daily challenge
**Files:** `src/core/run/daily.ts` + test, title menu, result screen, save.
- [ ] **Tests:** the UTC date gives seed `DAILY-YYYYMMDD`; stream `daily` picks the class and weapon; two devices on the same UTC day get the same kit, layout codes and Dragon roll; the first attempt becomes `official` (except a restart in its first 30 s); `bestTicks` keeps the best finish; it never writes PBs; 60 days kept; the share text matches 06 §14.1 exactly for a finished run, a death and an assisted run.
- [ ] **Title → Daily** row (between Play and Training Yard), showing today's kit and the official result if there is one.
- [ ] **Result screen** with **Share** (copies to the clipboard; on phones uses the share sheet when available).
- [ ] **Commit.**

### Task 5: Boss rush
**Files:** `src/core/run/bossRush.ts` + test, arenas loaded from the levels' boss sections, title menu, result screen, save.
- [ ] **Tests:** locked until `kingBeaten` (old saves: `runsCompleted > 0`); order of fights with and without the Dragon; each boss uses its own stage scaling; the loadout (Stage 4 practice preset + the class's second ability at Lv3); between fights flask refilled and HP +50%; time excludes fades; splits per boss; best per `class|dragon` only for non-assisted attempts; no unlocks or accessories.
- [ ] **Title → Boss Rush** (shown locked with `Beat the Enemy King to unlock` until unlocked), its setup screen and result screen.
- [ ] **Commit.**

### Task 6: E2E and hand-off
- [ ] **E2E:** launch and juggle a Wolf in the Training Yard (station 18), Rushing Strike (station 19); start today's Daily and check the kit; die and see the share text; unlock and start Boss Rush with debug helpers, kill each boss with debug helpers, and see the result. Screenshots of the new moves, the Daily result with Share, and the Boss Rush result. **Read them.**
- [ ] **Run everything; push to `main`.**
- [ ] **Hand-off:** "New moves: press Up + Attack on the ground to launch enemies, Up + Attack in the air to hit above you (with a little hop), and keep hitting launched enemies to juggle them for extra damage. Attack during a dash for a Rushing Strike. Try them in the Training Yard (stations 18 and 19). Plus a Daily challenge (same run for everyone each day, with a Share button) and Boss Rush (after you beat the King)." Ask: do the new moves feel good? Too strong? Is juggling fun?

## Done when
All tasks are checked, all checks pass, and the user has tried the moves.
