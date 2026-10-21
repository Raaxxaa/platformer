# M9 part 4: Stage 4 King's Castle, the Enemy King, the Dragon and the run ending

**Goal:** finish M9. The Rebel Camp inn loads the new `castle` level (Stage 4) with its 4 regular mobs, its elite and the Enemy King. Beating the King completes the run (victory screen, personal best, unlocks). The Dragon now appears in the side arena of Stage 2 or 3 when the run rolled it.

**Status: done (2026-10-20).** SPEC-GAPs 35 to 41 in `docs/SPEC-GAPS.md`; 28 and 29 are resolved here. Level source: `levels-src/castle/gen_castle.py` (a generator, like the Kingdom's), built by `npm run levels`.

**Spec:** `docs/spec/04-enemies-bosses.md` §7 (Stage 4 mobs), §8 (`arcane_bolt`, `royal_orb`, `falling_sword`, `fire_rain`), §9 (boss rules, 3 phases), §12 (Enemy King), §13 (Dragon); `docs/spec/06-run-levels-save.md` §2.6 (run complete), §4 (Dragon rule), §8.3 (`castle` row), §9.3, §10 (swinging blade), §12.2 (Rebel Camp: same layout as the Border, so the existing copy is the real one); `docs/spec/05-loot-economy.md` §14.2 and §14.3 (King unlocks), §3.5 (Dragon loot); `docs/spec/07-ui-hud-controls.md` §7.11 (run summary).

**How:** test first, one task per row. Enemies and bosses without art draw as the existing grey box with an eye; projectiles and area marks as flat shapes. No art is made here.

| # | Task | What is new | Tests |
|---|---|---|---|
| 1 | Stage 4 mobs | Royal Guard, Castle Mage Ward (channel, x0.5), Living Armor revive and pile, Royal Executioner (Whirling Axe, Leap Chop), `arcane_bolt` | ward ends on the listed conditions, pile is hit only by a dive slam, revive HP 50 percent |
| 2 | Gargoyle | stone form (x0.2, no knockback or poise), wake by range or damage, 0.5 s crack, hover point, Swoop, back to stone | wake rules, hover numbers, swoop ends on y, perch return |
| 3 | Enemy King | 3 phases (66 and 33 percent), phase skip, Royal Decree guards at the summon points, Scepter Orbs (homing, life), Shockwave Slam, Blade Rain, Throne Beam | phase table, decree only for entered phases, beam height and wall side, 3,960 HP |
| 4 | `castle` level | 8 sections from a generator, spikes, 4+ swinging blades, 3+ collapsing bridges, cannon gallery, wall-jump towers, summon points | `validateLevel`, `routeLint`, `reachLint`, route bot walks it |
| 5 | Swinging blades | 06 §10 pendulum hazard, 20 damage, not stage scaled | angle at t = 0 and 0.5 s, hurt i-frames only |
| 6 | Run flow and ending | Rebel Camp inn loads `castle`; King kill: split 4, `runComplete`, `runCompleted`, wins over a same-tick death; victory screen; King unlocks listed | same-tick rule, PB saved, unlock lines |
| 7 | Dragon | 4 colors, ground moves, Wing Gust, color specials, P2 air loop, passive when the player leaves, own-element immunity, outcome, loot (A or S with its element) | per-color special, passive keeps HP, outcome states, loot odds |
| 8 | E2E | each new enemy spawns and draws; King fight starts; Dragon fight starts in each color; a full win reaches the victory screen | `tests/e2e/stage4.spec.ts` |

**Done when:** typecheck, unit tests, build and e2e pass; `castle` passes `validateLevel`, `routeLint`, `reachLint`; the screenshots show no floating platforms or hazards.
