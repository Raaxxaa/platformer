# M9 part 2: the other 11 weapons

**Goal:** every weapon in `docs/spec/02-combat.md` §10–§13 is playable. M4 built 8 (Greatsword, War Maul, Katana, Iron Fists, Bow, Crossbow, Storm Hammer, Staff). This part adds the other 11.

**Status: done (2026-10-20).** Built by a build agent; SPEC-GAPs 22–27 in `docs/SPEC-GAPS.md`.

**What was missing (spec §10.1 vs `WEAPONS` in `src/data/weapons.ts`):** Twin Daggers, Spear, Scythe, Giant Axe, Flail, Shield, Hand Cannon, Javelin, Throwing Knives, Wand, Spell Tome. Adding a weapon to `WEAPONS` also puts it in the drop pool (`weaponPool` in `src/core/loot/roll.ts`) and lets the Training Yard hand it out.

**How:** one task per weapon, in this order (simple data first, then the ones with new rules). Each task: data rows in `src/data/weapons.ts` / `src/data/playerProjectiles.ts`, behavior in `src/core/combat/`, tests next to it (`src/core/combat/weapons.m9.test.ts` and `src/data/weapons.test.ts`), and its S-grade signature from 02 §13. No art is made here: a weapon with no `WEAPON_ART` row simply draws no weapon sprite (the player pose still plays), so nothing crashes.

| # | Weapon | Spec | What is new | Tests |
|---|---|---|---|---|
| 1 | Twin Daggers | 02 §10.2, §10.5, §13 | Backstab crit (hit mod); Shadow Step mark on dash-through (S) | 4 hits kill 30 HP at F (checklist 2); crit only from behind; `noFacing` never |
| 2 | Spear | 02 §10.5, §13 | Lunge (dash + button, or within 0.10 s after) as a forced move with a body sweep; Skewer Wave (S) | lunge 95 px, 24 damage, invulnerable, combo resets |
| 3 | Scythe | 02 §10.5, §13 | +3.0% flask fill on its kills; Soul Reap (S) | flask fill, souls home and fade |
| 4 | Giant Axe | 02 §10.5, §13 | Spin (ground, running): 0.80 s, 70% speed, turns, 4 hits per target; Cyclone (S) | spin triggers only when running, 4 hits max |
| 5 | Flail | 02 §10.5, §13 | Charge 0.60 s; release pulls small and medium enemies, then 0.6 s forced stagger; Meteor (S) | pull point, large enemies knocked back |
| 6 | Hand Cannon | 02 §10.4–10.5, §13 | Cannonball explodes on contact; recoil impulse (air: also up); Big Bore (S) | recoil numbers, blast hits once, no self-damage |
| 7 | Throwing Knives | 02 §10.3, §13 | 3 knives per throw; Fan of Blades (S) | 3 hit groups, all hit near targets |
| 8 | Wand | 02 §10.4–10.5, §13 | Homing shots (radius 96, 180°/s); auto-fires while held; Seeker Swarm (S) | homes ahead only; every 5th shot is 3 shots |
| 9 | Spell Tome | 02 §10.5, §13 | Rune Ring (4 orbiting runes, one hit group, 2.0 s); Rune Storm (S) | ring replaces itself, ends when the Tome leaves its slot |
| 10 | Javelin | 02 §10.4–10.5, §13 | Sticks into walls and becomes a pixel-exact one-way platform (6.0 s, max 2); Anchor (S) | platform is standable, 3rd removes oldest, floor hit vanishes |
| 11 | Shield | 02 §12, §13 | Raise/parry/block/bash state machine and the hurt-pipeline hook; Aegis (S) | parry window, block x0.25, projectile reflect |

**Also done here:** the third starting weapons (Spear, Giant Axe, Throwing Knives, Wand) now appear in the class pick once unlocked (07 §6.7, 05 §14.3), and a saved kit that holds one loads normally. Tests that assumed "8 weapons exist" (loot pool, shop, records, session) were updated. The e2e photos are `test-results/m9-weapon-*.png`.

**Done when:** all 19 weapons have defs, every new weapon passes its tests, the DPS test (checklist 3) covers all 19 except the Shield, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` pass, and `tests/e2e/weapons-m9.spec.ts` equips each new weapon in `?debug=1` mode, attacks, and takes a screenshot.
