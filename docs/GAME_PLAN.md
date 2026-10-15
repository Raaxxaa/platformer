# Game Plan — Speedrun Action Platformer (working title: **RUSHBLADE**)

> Draft v2. Read it over and mark anything you want changed. Every section is
> numbered so you can say things like "change 5.2" or "cut section 9".

### What changed in v2 (from your notes)
- Confirmed: it's **Dead Cells**–style.
- New **weapon grades F → C → B → A → S**. Same weapon, stronger at higher grades, with powers (fire, ice…) → section 7.1–7.3
- Grade odds get better each world, and riskier chests have better odds → 7.3
- New chests: **Lucky Block** (random buff or debuff), **key chests** (need a key found further in the level), **free loot**. Cursed chest kept with the 10-kill curse → 7.4–7.7
- Bosses reworked: each world ends with a **Guardian** (giant, stronger version of an enemy from that world), **big bosses** in the middle and at the end, and **roaming bosses** that can show up in any stage and drop better loot → 6.3

---

## 0. Decided vs. still assumed

**Decided**
- Dead Cells–style 2D side-view action platformer, built for speed.
- Has its own ideas, so it's not a copy: weapon grades + elements, Lucky Blocks, Guardians, roaming bosses, Rush meter.

**Still my assumptions. Change any of these:**

| # | My assumption | Other option |
|---|---|---|
| A2 | It's a **roguelite**: if you die, the run restarts from World 1. | Restart only the current world |
| A3 | **6 worlds**, each world is **one stage**. | More or fewer worlds |
| A4 | Stage layouts are **hand-made and the same every run** (so speedrunners can learn routes). Only loot, Lucky Blocks and roaming bosses are random. | Random layouts like Dead Cells |
| A5 | **Pixel art**, 2D, side view. | |
| A6 | Plays on **PC in the browser**, keyboard or controller. | |
| A7 | Single player only. | |

---

## 1. The pitch

Dead Cells–style combat and loot, but built around **going fast**. You carry
big weapons and cooldown abilities. You cut through each world in one continuous
stage, gamble on Lucky Blocks, open chests, and find better and better graded
weapons that pick up fire, ice and lightning powers as they go up in grade.
Every world ends with a Guardian, and big bosses wait in the middle and at the
end. A timer is always on screen. Good players get faster by learning the
stage, building a better loadout, and chaining movement and attacks without
stopping.

**Run length targets**

| | One world | Full run (6 worlds) |
|---|---|---|
| First time playing | 4–6 min | 30–40 min |
| Average player who knows it | 2.5–3.5 min | 15–20 min |
| Good speedrunner | ~1:30 | ~9–10 min |

---

## 2. Core loop

1. Start run → pick a starting weapon (from 3 random, all F or C grade).
2. Play through the world's stage: kill, move, hit Lucky Blocks, grab keys, open chests, decide on detours.
3. Maybe run into a **roaming boss**. Fight it for top loot, or skip it to save time.
4. Shop room before the end of the world → spend gold.
5. Beat the **Guardian** (or a big boss in Worlds 3 and 6) → world split time shows (green = faster than your best, red = slower).
6. Short transition (pick 1 of 3 stat upgrades) → next world. Loot odds go up.
7. Beat the final boss → run time, summary screen, personal best saved.
8. Die → instant restart from World 1 (one button, no menus).

---

## 3. Movement (this is what makes it a speedrun game)

Movement has to feel great before anything else gets built.

| Move | What it does | Speed role |
|---|---|---|
| Run | Fast base speed, almost no acceleration delay | |
| Jump / double jump | Variable height (hold = higher) | |
| Dash | Short burst, brief invincibility, works in the air | Main way to go fast; cancels attacks |
| Wall slide + wall jump | On any wall | Climb shafts, skip platforms |
| Slide | Dash on the ground while holding down: go under gaps, keep speed | |
| Dive slam | Down + attack in the air: slam down, bounce off enemies | Fast descents, bounce chains |
| Ledge grab | Auto, quick pull-up | Never lose a jump by a pixel |

**Speed rules**
- **Every attack can be cancelled by dash or jump.** Big weapons still hit hard, but they never trap you.
- **Keep momentum:** dash-jumping carries dash speed into the jump.
- **Coyote time + jump buffer** (jump still works a few frames late or early) so it feels fair.
- No fall damage.

---

## 4. Combat

### 4.1 Loadout
- **2 weapon slots**: any mix of melee, ranged, or shield.
- **2 ability slots**: cooldown skills.
- **1 heal flask**: 2 charges, refilled at shops. Drinking it is fast (~0.4s) so it doesn't kill the pace.

### 4.2 Weapons (starting list, ~12 for first version)
Every weapon can drop at any grade (F to S). See section 7.1 for what grades do.

| Weapon | Feel | Base special |
|---|---|---|
| Greatsword | Big, wide swings | 3rd hit of combo is a huge cleave |
| War Hammer | Slow, massive | Dive slam with it makes a shockwave |
| Twin Daggers | Super fast | Crits from behind |
| Spear | Long reach | Attack while dashing = lunge through enemies |
| Scythe | Big arc | Heals a little on kills |
| Chain Blade | Mid-range whip | Pulls small enemies to you |
| Katana | Fast + big | Hold to charge a dash-slash that goes through enemies |
| Giant Axe | Heaviest weapon | Spin attack while moving |
| Bow | Ranged | Charged shot pierces |
| Hand Cannon | Ranged, slow | Knocks you backward (movement tech!) |
| Shield | Defense | Perfect parry stuns and refunds dash |
| Gauntlets | Close combo | Uppercut launches you upward too |

**Speed twist on big weapons:** heavy weapons get **faster while your Rush meter is high** (see 5.1), so big weapons reward staying aggressive.

### 4.3 Abilities (starting list, ~8)

| Ability | What it does |
|---|---|
| Grapple Hook | Pull yourself to walls/enemies. Big movement skill |
| Blink | Teleport a short distance, even through thin walls |
| Shockwave | Ground blast, knocks enemies up |
| Bomb | Throw, explodes, can bomb-jump |
| Frost Burst | Freeze enemies around you |
| Turret | Drop a turret that shoots for 8s |
| Spinning Blades | Saws orbit you for a few seconds |
| Time Slow | Slow everything except you for 3s |

### 4.4 Enemies
- Regular enemies **die fast** (2–4 hits from a good weapon). No damage sponges. They're things to cut through, not walls.
- Each world has 4–5 enemy types + 1 elite version. One of them becomes that world's Guardian (6.3).
- Elites sometimes drop a **key** (7.7).
- Enemies get stunned/staggered easily so you can push through.
- Clear warning flash before every attack.
- Enemies get tougher each world, so you need the better grades you find later.

### 4.5 Bosses
See section 6.3.

---

## 5. Speedrun systems

### 5.1 Rush meter
- Fills from kills, combos, dash-through attacks, and not stopping.
- Drains when you stand still or get hit.
- 3 levels: each level gives more move speed, attack speed, and gold drops.
- Max Rush has a visual effect (trail, music layer) so it feels good.

### 5.2 Timer and splits
- Run timer always on screen (can be turned off).
- Split for each world, compared to your personal best (green/red).
- Timer pauses only in menus. It does **not** stop in shops or when opening chests (looting costs time, that's the point).

### 5.3 Timed doors
- Some chest rooms are behind a door that **only opens if you reach it under a time limit**. Rewards: a weapon at key-chest odds (7.3) plus big gold.

### 5.4 Quality-of-life for speedrunners
- One-button instant restart.
- **Seeded runs**: type a seed to get the same loot, Lucky Blocks and roaming bosses every time (for races).
- **World Practice mode**: play any world you've reached, timed, with a preset loadout.
- Ghost replay of your best world time (later milestone).

---

## 6. Worlds and bosses

Every world = **one continuous stage** → shop room → end boss.

| # | World | Gimmick | End boss |
|---|---|---|---|
| 1 | **Ashen Gate** (castle walls) | Teaches dash, wall jump, slide | Guardian: **Giant Shield Knight** |
| 2 | **Drowned Sewers** | Water slows you unless you dash/slide; bounce off pipes | Guardian: **Sludge Brute** |
| 3 | **Clockwork Tower** | Moving gears, platforms on timers, vertical climb | **BIG BOSS: The Clockmaker** (mid-run) |
| 4 | **Crimson Forest** | Grapple points, tree-top routes vs ground route | Guardian: **Elder Stag** |
| 5 | **Frozen Mines** | Ice keeps your momentum, minecart section | Guardian: **Ice Golem** |
| 6 | **The Sunken Throne** | Mix of everything, hardest enemies | **FINAL BOSS: The Drowned King** |

### 6.1 How one stage is built (template)
Each stage is about 8 sections chained together:

1. **Start**: short run-in, a free weapon or Lucky Block
2. **Combat stretch**: groups of enemies on flat ground
3. **Traversal**: platforming using the world's gimmick
4. **Branch**: main path vs side path (key or chest) vs **skip route** (hard movement, saves time)
5. **Arena**: doors lock, wave of enemies (fast kills = faster exit). Possible roaming boss spot.
6. **Traversal 2**: harder version of section 3
7. **Loot area**: key chest, cursed chest or timed door (optional)
8. **Shop room** → **Boss door**

Each stage has about: 3–4 Lucky Blocks, 2 free loot spots, 2 keys, 3 locked key chests, 1 cursed chest. That's fewer keys than locked chests, so you pick which chests to open.

### 6.2 Routes
- **Main path**: always clear where to go (arrows/lighting). Never lost.
- **Side paths**: keys and chests, cost 10–30s detour. Worth it or not? That's the speedrun choice.
- **Skip routes**: need good movement or a specific ability (Grapple, Blink). Save time.

### 6.3 Boss types

| Type | Where | What it is | Loot |
|---|---|---|---|
| **Guardian** | End of Worlds 1, 2, 4, 5 | A giant, stronger version of one of that world's regular enemies, with 1–2 new attacks. Short fight (~30–60s). | 1 weapon at key-chest odds |
| **Big boss (mid)** | End of World 3 | A real boss with its own design, 2 phases (~60–90s) | 1 weapon, **B grade or better** |
| **Big boss (final)** | End of World 6 | Final boss, 3 phases | Ends the run |
| **Roaming boss** | Can show up in **any stage** (~15% chance per stage), in an arena next to the main path | Each one comes from a specific biome but can appear anywhere. **Optional**: skip it to save time, or fight it for great loot. | 1 weapon, **A grade or better**, with that boss's element |

Big bosses have **stagger phases**: hit them hard enough and they drop, which opens a big damage window. Fast players skip phases.

**Roaming bosses (first 4)**, one per element:

| Roaming boss | Home biome | Element of its loot |
|---|---|---|
| Ember Wyrm | Ashen Gate | Fire |
| Bog Witch | Drowned Sewers | Poison |
| Storm Knight | Clockwork Tower | Lightning |
| Frost Wraith | Frozen Mines | Ice |

At most 1 roaming boss per stage. You can't get the same one twice in a run.

---

## 7. Loot

### 7.1 Weapon grades (F → C → B → A → S)
Every weapon drops with a grade. It's the **same weapon, upgraded**: more damage, plus powers at higher grades.

| Grade | Color | Damage | Power |
|---|---|---|---|
| **F** | Gray | 80% | Nothing |
| **C** | Green | 100% | Nothing |
| **B** | Blue | 125% | 1 element (fire, ice, lightning, poison, or wind) |
| **A** | Purple | 160% | Stronger element + 1 bonus perk (faster attacks, crit chance, lifesteal, etc.) |
| **S** | Gold | 200% | Max-strength element + perk + a **signature move** and its own name |

S-grade example: a fire Greatsword becomes **"Sunbreaker"**, and its 3rd hit sends a wave of fire along the ground. An ice Katana becomes **"Glacier Fang"**, and its dash-slash freezes everything it passes.

The grade color shows on the item and in the swap popup, so you can tell in a split second if it's better.

### 7.2 Elements

| Element | What it does |
|---|---|
| **Fire** | Burns enemies over time; burning enemies spread fire when they die |
| **Ice** | Slows enemies; enough hits freezes them; hitting a frozen enemy shatters it for big damage |
| **Lightning** | Each hit jumps to 2 nearby enemies |
| **Poison** | Stacks damage over time; more hits = more stacks |
| **Wind** | Big knockback, and **every kill refunds your dash** (the speed element) |

### 7.3 Grade odds

**Free loot by world.** Odds get better as you go deeper:

| World | F | C | B | A | S |
|---|---|---|---|---|---|
| 1 | 50% | 35% | 10% | 4% | 1% |
| 2 | 35% | 38% | 18% | 7% | 2% |
| 3 | 20% | 38% | 27% | 12% | 3% |
| 4 | 10% | 30% | 35% | 20% | 5% |
| 5 | 5% | 20% | 38% | 29% | 8% |
| 6 | 0% | 10% | 35% | 43% | 12% |

**Riskier sources get better odds.** World 1 example:

| Source | Risk | F | C | B | A | S |
|---|---|---|---|---|---|---|
| Free loot | None | 50% | 35% | 10% | 4% | 1% |
| Key chest / Guardian / timed chest | Detour for a key, boss fight, or beating the clock | 35% | 38% | 18% | 7% | 2% |
| Cursed chest | One-hit death until 10 kills | 0% | 20% | 50% | 25% | 5% |
| Roaming boss | Optional boss fight | 0% | 0% | 0% | 75% | 25% |

In later worlds every source moves up the same way free loot does. Exact numbers will get tuned in playtesting.

### 7.4 Chest types

| Chest | What you get | Catch |
|---|---|---|
| **Free loot** | A weapon (on a stand, or in an open chest) | None |
| **Lucky Block** | A random **buff or debuff** | It's a gamble (7.5) |
| **Key chest** | Choose 1 of 2 weapons | Needs a key (7.7) |
| **Cursed chest** | A high-grade weapon + lots of gold | A curse (7.6) |
| **Timed chest** | A weapon | Behind a timed door (5.3) |

- Opening is **instant**, with no long animation.
- Items pop out and you swap with one button, with a quick compare popup (grade color + damage).

### 7.5 Lucky Block
You **hit it with your weapon** (no stopping to open it). It pops and shows what you got in big text.

- **55% buff, 45% debuff.**
- Buffs last until the end of the current world. Debuffs last 45 seconds, so they hurt but never ruin a run.

| Buffs | | Debuffs | |
|---|---|---|---|
| **Swift** | +25% move speed | **Heavy** | −20% move speed |
| **Golden Touch** | Double gold from enemies | **Glass Bones** | Take double damage |
| **Firestarter** | All your hits burn | **Leaky Pockets** | Drop gold every time you get hit |
| **Second Wind** | Revive once with half HP | **Ambush** | A pack of enemies spawns around you right now |
| **Overdrive** | Rush meter can't drop below level 2 | **Jammed** | Dash cooldown doubled |
| **Jackpot** (rare) | Drops an A or S weapon | **Butterfingers** | Weapon 2 is locked |

### 7.6 Cursed chest
- Drops a high-grade weapon (see odds in 7.3) and lots of gold.
- **Curse: you die in one hit until you kill 10 enemies.** A counter shows how many kills are left.
- Optional extra curses for variety later. All of them also lift after 10 kills: **No Heal** (can't drink the flask), **Heavy Feet** (no double jump), **Hunted** (enemies are faster). Cut these if you only want the one curse.

### 7.7 Keys
- Locked key chests need a key. **1 key opens 1 chest.**
- Keys are **a little further through the level**: at the end of a side path, after a hard jump section, or dropped by elite enemies.
- You can carry up to 3 keys. Leftover keys carry over to the next world.
- Shops sometimes sell a key.

---

## 8. Shops

- **One shop per world**, in the room right before the boss.
- Sometimes a **wandering merchant** mid-stage (random, rare stock).
- Shop sells: 3 weapons/abilities (using that world's odds, at least one is **B or better**), heal flask refill, 1 stat upgrade, sometimes a key, and a reroll (gets pricier).
- Buying is **walk up + press one button**. No menus. Fast.
- **Gold** comes from enemies + chests, and resets every run.

---

## 9. Progression

### 9.1 Inside a run
- Weapons and abilities you find (swap anytime). Grades go up as you go deeper (7.3).
- Stat upgrades after each end-of-world boss: pick 1 of 3 (+damage, +HP, +speed, +cooldown, etc.).
- Enemies get tougher each world, so finding higher grades matters.

### 9.2 Between runs (light meta)
- Sometimes enemies drop **blueprints** that unlock a new weapon or ability into the loot pool.
- **No permanent stat boosts**, so runs are always fair to compare for speedrunning.
- Unlock new starting weapon choices and cosmetic outfits from achievements.

---

## 10. Controls (default)

| Action | Keyboard | Controller |
|---|---|---|
| Move | A / D (or arrows) | Left stick |
| Jump | Space | A |
| Dash | Shift | RB |
| Weapon 1 / Weapon 2 | J / K | X / Y |
| Ability 1 / Ability 2 | U / I | LT / RT |
| Heal | Q | LB |
| Interact / swap | E | B |
| Instant restart | R (hold) | Select (hold) |

All rebindable.

---

## 11. Look and sound
- Pixel art, 2D side view. Each world has its own color palette so you always know where you are.
- **Game feel** is a priority: hit-stop on big hits, screen shake, enemy flash, punchy sounds.
- Each element has its own look and sound (fire crackle, ice shatter, etc.).
- Music speeds up / adds layers with Rush level.
- Start with simple placeholder shapes, add real art after the game feels good.

---

## 12. Tech

**Recommended:** **Phaser 3 + TypeScript + Vite**, levels made in **Tiled** (free map editor).
- Runs in any browser: share a link, upload to itch.io, no install.
- I can build, run, and test it directly in this setup.
- Tiled makes hand-building the 6 stages easy.

**Alternative:** **Godot 4**. It's a free engine, very good for 2D, with a visual editor you'd use yourself. Better if you want to do a lot of the editing by hand; it needs an install.

Planned code layout (Phaser):
```
src/
  main.ts             game setup
  scenes/             Boot, Menu, World, Shop, Boss, RunSummary
  player/             movement, combat, loadout
  weapons/ abilities/ one file per item + shared data tables
  loot/               grades, elements, odds tables, chests, Lucky Block, keys
  enemies/ bosses/    regular enemies, Guardians, big bosses, roaming bosses
  systems/            rush meter, timer/splits, save data
  levels/             Tiled JSON per world
assets/               sprites, sounds, music
```

---

## 13. Build order (milestones)

Each milestone ends with something you can play.

| M | Goal | You can play… |
|---|---|---|
| M0 | Project setup | An empty screen with a square you can move |
| M1 | **Movement feel** | A grey test level with all moves from section 3 |
| M2 | **Combat core** | 2 weapons (Greatsword + Daggers), 2 enemy types, HP, death, restart |
| M3 | **World 1 stage** (grey boxes) | Full Ashen Gate stage start to end, timer + splits |
| M4 | **Loot** | Grades F–S, elements, free loot, Lucky Blocks, keys + key chests, cursed chest, shop, 2 abilities |
| M5 | **First Guardian** | Giant Shield Knight fight |
| M6 | **Run structure** | World → upgrade pick → next world, run summary, PB saving, instant restart |
| M7 | **Worlds 2–3 + mid boss** | Clockmaker fight, more weapons/abilities/enemies, Rush meter, timed doors, first roaming boss |
| M8 | **Art + sound pass** | Worlds 1–3 look and sound real |
| M9 | **Worlds 4–6** | Full game, final boss, all 4 roaming bosses |
| M10 | **Speedrun extras + polish** | Seeds, practice mode, ghosts, balance |

**First thing to make fun: M1.** If running and jumping around the empty test level isn't fun, nothing else will be.

---

## 14. Questions for you

**New from v2**
1. Grades are **F, C, B, A, S** (5 grades, no D). Want a D in there too?
2. Grades only for **weapons**, or abilities too (shorter cooldown, bigger effect)?
3. Roaming bosses: did I get it right? Each one comes from one biome but can randomly show up in any stage.
4. Lucky Block at **55% buff / 45% debuff**. Okay, or more gamble-y (50/50)?

**Still open from v1**

5. Die = restart whole run, or just restart the current world? (A2)
6. Same layouts every run (speedrun-friendly) or random layouts? (A4)
7. 6 worlds okay? More/fewer?
8. Phaser (browser) or Godot?
9. Do you have art in mind / will you draw it, or should I use placeholder + free asset packs?
10. Name: keep "RUSHBLADE" as a working title, or something else?
