# M9 part 1: the other 8 abilities

**Goal:** every ability in `docs/spec/03-classes-abilities.md` §8–§11 is playable. M4 built 9 (Blade Dash, Whirlwind, Shockwave, Shoulder Charge, Arrow Rain, Hunter's Mark, Thunder Strike, Blink, Vampire). This part adds the other 8.

**How:** one company task per ability, done in order (they all add to `src/data/abilities.ts` and `src/core/abilities/list/index.ts`). Each one: per-level numbers in `src/data/abilities.ts`, behavior in `src/core/abilities/list/<id>.ts`, its own `src/core/abilities/<id>.test.ts` built on the 03 test checklist.

| # | Ability | Spec | Checklist | Who |
|---|---|---|---|---|
| 1 | Rage | 03 §9.3 | — | company (T0001) |
| 2 | Frost Burst | 03 §11.2 | 26 | company (T0002) |
| 3 | Blade Flurry | 03 §8.3 | — | company (T0003) |
| 4 | Boulder Toss | 03 §9.4 | — | company (T0004) |
| 5 | Turret | 03 §10.2 | 22 | company (T0005) |
| 6 | Riposte | 03 §8.4 | 28 | after 1–5 (touches the hurt pipeline, 02 §5.2 step 2) |
| 7 | Grapple Arrow | 03 §10.3 | 23 | after 1–5 (ForcedMove and grapple points, 01 §13.7) |
| 8 | Time Slow | 03 §11.4 | 29 | after 1–5 (adds `worldTimeScale` across enemies, projectiles and hazards) |

Abilities 6–8 cross several systems, so the head splits or builds them once the first five are in.

**Done when:** all 17 abilities have defs (03 checklist item 5), each new test passes, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` pass, and every new ability can be picked up in the Training Yard. The art for the new ability effects is already in ART5.
