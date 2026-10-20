# M9 part 3: Stage 3 Enemy Kingdom and the Black Knight

**Goal:** the run continues past the Border Village. The Border inn now loads the new `kingdom` level (Stage 3), with its 4 regular mobs, its elite and the Black Knight. Stage 4 and the Enemy King are the next part.

**Status: done (2026-10-20).** Built by a build agent; SPEC-GAPs 28 to 34 in `docs/SPEC-GAPS.md`. Level source: `levels-src/kingdom/gen_kingdom.py` (a generator, like the Training Yard's), built by `npm run levels`.

**Spec:** `docs/spec/04-enemies-bosses.md` §6 (Stage 3 mobs), §8 (`enemy_bolt`, `fireball`, `dark_wave`), §9 (boss rules), §11 (Black Knight); `docs/spec/06-run-levels-save.md` §8 (the 8 sections, `kingdom` row), §9 (arenas), §10 (cannon), §12.2 (Rebel Camp); `docs/spec/05-loot-economy.md` §5.5 (Black Knight loot), §7.5 and §9.5 (Ambush pack, enemy mix).

**What was missing:** the Stage 3 `ENEMIES` rows, the chain-attack runner (a multi-hit attack was in the data shape but never run), Soldier shield rules, Knight armor, War Hound packs, Battle Mage Teleport, Crossbowman aim lock, Bulwark, the boss phase transition, the cannon hazard, the `kingdom` level, and the route from the Border inn.

**How:** test first, one task per row. Enemies without art draw as grey boxes with an eye (the existing fallback); projectiles without art draw as boxes. No art is made here.

| # | Task | What is new | Tests |
|---|---|---|---|
| 1 | Chain attacks | `RunningAttack.link`; each chain hit has its own Tele (0.30 s), Act, hit group and Move; `phases` filter | Knight combo: 2 hits, 2nd has its own Tele; Quad Slash only in phase 2 |
| 2 | Soldier, Knight | Shield guard that is down during Sword Thrust only; armor ×0.75 unless heavy | frontal ×0.2, back full, down while thrusting; armor numbers |
| 3 | Crossbowman, War Hound | Aim line tracks for 0.5 s then locks 0.2 s; ±45 degree clamp; hound `packIndex` band | locked aim, clamp, bands 40-64 / 64-88 / 88-112 |
| 4 | Battle Mage | Teleport reaction (176 px, fade out 0.3 s, fade in 0.3 s, CD 5.0 s); Fireball (Burning); Flame Burst | teleport distance and timing, hittable while fading |
| 5 | Black Knight | Data, phases, 1.0 s transition (waits for Break), Bulwark stance, Dark Wave, Leaping Slam, loot (B or better weapon + ability) | transition, Bulwark guard ×0.1 and Shield Bash, loot odds, 3,120 HP |
| 6 | Cannon hazard | 06 §10: telegraph, 300 px/s ball, 20 damage, no stage scaling | fire interval, range, solid stop |
| 7 | `kingdom` level | 8 sections from a generator, streets vs rooftops, cannons, arenas, side arena, `dragon_warning` | `validateLevel`, `routeLint`, `reachLint`, route bot walks it |
| 8 | Run flow | Border inn loads `kingdom`; its exit goes to the Rebel Camp; the Rebel Camp inn ends the run for now ("Run so far") | carry test, inn test |
| 9 | E2E | each new enemy spawns and draws; the Black Knight fight starts; screenshots of the stage | `tests/e2e/stage3.spec.ts` |

**Dragon:** the roll still happens at run start. The Stage 3 side arena exists and is empty (as in Stage 2). The Dragon fight is its own part, so a Dragon rolled for Stage 3 is not spawned yet.

**Done when:** typecheck, unit tests, build and e2e pass; `kingdom` passes `validateLevel`, `routeLint`, `reachLint`; the screenshots show no floating platforms or hazards.
