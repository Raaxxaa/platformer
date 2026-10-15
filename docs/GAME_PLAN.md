# Game Plan — Speedrun Action Platformer (working title: **RUSHBLADE**)

> Draft v3. Read it over and mark anything you want changed. Every section is
> numbered so you can say things like "change 6.2" or "cut section 10".

### What changed in v3 (from your notes)
- New **classes**: Swordsman, Thief, Archer, Mage. Each has its own weapons and a passive → section 4
- **Combine classes** mid-run (Archer + Mage = Arcane Archer, Swordsman + Mage = Spellblade, etc.) → 4.3
- **Heal flask recharges from kills** instead of only at shops → 5.2
- New **Vampire** ability: kills fill the flask way faster → 5.2, 5.4
- Mage weapons added (Staff, Wand, Spell Tome), and a few more for other classes → 5.3
- Sections after 3 got renumbered by one because Classes is now section 4.

---

## 0. Decided vs. still assumed

**Decided**
- Dead Cells–style 2D side-view action platformer, built for speed.
- Has its own ideas, so it's not a copy: classes + combo classes, weapon grades + elements, kill-charged flask, Lucky Blocks, Guardians, roaming bosses, Rush meter.

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

Dead Cells–style combat and loot, but built around **going fast**. Pick a
class, carry big weapons and cooldown abilities, and cut through each world in
one continuous stage. Gamble on Lucky Blocks, open chests, and find better
graded weapons that pick up fire, ice and lightning powers as they go up in
grade. Halfway through the run you merge with a second class and become
something new. Your heal flask only refills by killing, so the best defense is
staying aggressive. A timer is always on screen.

**Run length targets**

| | One world | Full run (6 worlds) |
|---|---|---|
| First time playing | 4–6 min | 30–40 min |
| Average player who knows it | 2.5–3.5 min | 15–20 min |
| Good speedrunner | ~1:30 | ~9–10 min |

---

## 2. Core loop

1. Start run → **pick a class** → pick its starting weapon (1 of 2, C grade).
2. Play through the world's stage: kill (this also refills your flask), move, hit Lucky Blocks, grab keys, open chests, decide on detours.
3. Maybe run into a **roaming boss**. Fight it for top loot, or skip it to save time.
4. Shop room before the end of the world → spend gold.
5. Beat the **Guardian** (or a big boss in Worlds 3 and 6) → world split time shows (green = faster than your best, red = slower).
6. Short transition (pick 1 of 3 stat upgrades) → next world. Loot odds go up.
7. After World 2: **Class Shrine**. Pick a second class to combine with yours.
8. Beat the final boss → run time, summary screen, personal best saved.
9. Die → instant restart from World 1 (one button, no menus).

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

## 4. Classes

### 4.1 How classes work
- You pick a class at the start of every run.
- **You can still use any weapon**, but your **class weapons do +25% damage** and get the class bonus. That way no loot drop is ever useless.
- Each class has a **passive** that's always on. No extra buttons.
- You start with a C-grade class weapon (choose 1 of 2). Your second weapon and abilities come from loot.

### 4.2 The four classes

| Class | Style | Class weapons | Passive |
|---|---|---|---|
| **Swordsman** | Big hits, tanky | Greatsword, War Hammer, Giant Axe, Spear, Shield | **Iron Will:** +30% max HP, and you can't be knocked back while swinging |
| **Thief** | Fastest class | Twin Daggers, Katana, Chain Blade, Throwing Knives, Gauntlets | **Shadowstep:** 2 dash charges instead of 1. **Lockpick:** open 1 key chest per world without a key |
| **Archer** | Ranged, mobile | Bow, Crossbow, Hand Cannon, Boomerang Glaive | **Eagle Eye:** long-range hits always crit. Aiming in the air slows your fall so you can shoot mid-jump |
| **Mage** | Elements + abilities | Staff, Wand, Spell Tome, Scythe | **Arcane Flow:** abilities recharge 25% faster, elements are stronger, and **C-grade weapons also get an element** (normally only B and up do) |

Starting weapon choices: Swordsman: Greatsword or Spear. Thief: Twin Daggers or Katana. Archer: Bow or Crossbow. Mage: Staff or Wand.

### 4.3 Combining classes
After you beat the World 2 Guardian, a **Class Shrine** appears. Pick a second class and you **combine** into a hybrid:
- You keep **both passives**.
- **Both classes' weapons** get the +25% bonus.
- You get a **combo perk** that only that hybrid has.

| Combo | Hybrid name | Combo perk |
|---|---|---|
| Swordsman + Mage | **Spellblade** | Every melee hit makes your abilities recharge 0.5s faster |
| Swordsman + Thief | **Duelist** | Dash through an enemy's attack → your next hit is a guaranteed crit |
| Swordsman + Archer | **Warden** | Melee hit → next shot does +50%. Shot hit → next melee hit does +50% |
| Thief + Mage | **Trickster** | Dashing leaves a decoy that explodes with your weapon's element |
| Thief + Archer | **Shadowshot** | Shooting while dashing always crits, and ranged kills refund your dash |
| Archer + Mage | **Arcane Archer** | Every arrow carries an element (even F-grade bows), and charged shots explode |

**Or double down:** pick your own class again to become a **Master** with your passive twice as strong. The four Masters are Warlord (Swordsman), Phantom (Thief), Sharpshooter (Archer) and Archmage (Mage).

---

## 5. Combat

### 5.1 Loadout
- **2 weapon slots**: any mix of melee, ranged, magic, or shield.
- **2 ability slots**: cooldown skills.
- **Heal flask**: see 5.2.

### 5.2 Healing: the flask recharges from kills
- The flask has **2 charges** to start. Each charge heals 40% HP. Drinking is fast (~0.4s).
- Under the flask icon is a **fill bar**. **Kills fill it**, and a full bar = 1 charge back.

| Kill | Fills |
|---|---|
| Regular enemy | 1/12 of a charge (12 kills = 1 charge) |
| Elite enemy | 3/12 |
| Guardian / big boss / roaming boss | Refills the whole flask |

- You start every run with a full flask. It does **not** refill on its own between worlds, so you have to keep killing.
- More ways to fill it faster:
  - **Vampire** ability (5.4): for 8s, every kill fills **3x as much** and heals you a little.
  - **Scythe**: kills with it fill the bar 50% more.
  - **Bloodthirst** stat upgrade (in the pick-1-of-3 pool): kills fill 25% more.
- Shops sell a **flask upgrade** (+1 max charge, up to 4) and an expensive instant refill.

### 5.3 Weapons (first version, ~18)
Every weapon can drop at any grade (F to S). See section 8.1 for what grades do.

**Swordsman**

| Weapon | Feel | Special |
|---|---|---|
| Greatsword | Big, wide swings | 3rd hit of combo is a huge cleave |
| War Hammer | Slow, massive | Dive slam with it makes a shockwave |
| Giant Axe | Heaviest weapon | Spin attack while moving |
| Spear | Long reach | Attack while dashing = lunge through enemies |
| Shield | Defense | Perfect parry stuns and refunds dash |

**Thief**

| Weapon | Feel | Special |
|---|---|---|
| Twin Daggers | Super fast | Crits from behind |
| Katana | Fast + big | Hold to charge a dash-slash that goes through enemies |
| Chain Blade | Mid-range whip | Pulls small enemies to you |
| Throwing Knives | Fast ranged | Throws 3 at once, never runs out |
| Gauntlets | Close combo | Uppercut launches you upward too |

**Archer**

| Weapon | Feel | Special |
|---|---|---|
| Bow | Ranged | Charged shot pierces |
| Crossbow | Slow, heavy bolts | Bolts pin enemies to walls |
| Hand Cannon | Ranged, slow | Knocks you backward (movement tech!) |
| Boomerang Glaive | Curved throw | Hits on the way out and on the way back |

**Mage**

| Weapon | Feel | Special |
|---|---|---|
| Staff | Magic bolts | Hold to charge a big exploding orb |
| Wand | Rapid small shots | Shots slightly home in on enemies |
| Spell Tome | Close-range magic | Opens a ring of spinning runes around you |
| Scythe | Mage's melee | Big arc; kills fill the flask 50% more |

**Speed twist on big weapons:** heavy weapons get **faster while your Rush meter is high** (see 6.1), so big weapons reward staying aggressive.

### 5.4 Abilities (first version, ~9)

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
| **Vampire** | For 8s, kills fill the flask 3x as much and heal you a little. Cooldown 30s |

### 5.5 Enemies
- Regular enemies **die fast** (2–4 hits from a good weapon). No damage sponges. They're things to cut through, not walls.
- Each world has 4–5 enemy types + 1 elite version. One of them becomes that world's Guardian (7.3).
- Elites sometimes drop a **key** (8.7).
- Enemies get stunned/staggered easily so you can push through.
- Clear warning flash before every attack.
- Enemies get tougher each world, so you need the better grades you find later.

### 5.6 Bosses
See section 7.3.

---

## 6. Speedrun systems

### 6.1 Rush meter
- Fills from kills, combos, dash-through attacks, and not stopping.
- Drains when you stand still or get hit.
- 3 levels: each level gives more move speed, attack speed, and gold drops.
- Max Rush has a visual effect (trail, music layer) so it feels good.

### 6.2 Timer and splits
- Run timer always on screen (can be turned off).
- Split for each world, compared to your personal best (green/red).
- Timer pauses only in menus. It does **not** stop in shops, at the Class Shrine, or when opening chests. Deciding costs time, that's the point.

### 6.3 Timed doors
- Some chest rooms are behind a door that **only opens if you reach it under a time limit**. Rewards: a weapon at key-chest odds (8.3) plus big gold.

### 6.4 Quality-of-life for speedrunners
- One-button instant restart.
- **Seeded runs**: type a seed to get the same loot, Lucky Blocks and roaming bosses every time (for races).
- **World Practice mode**: play any world you've reached, timed, with a preset loadout and class.
- Ghost replay of your best world time (later milestone).

---

## 7. Worlds and bosses

Every world = **one continuous stage** → shop room → end boss.

| # | World | Gimmick | End boss |
|---|---|---|---|
| 1 | **Ashen Gate** (castle walls) | Teaches dash, wall jump, slide | Guardian: **Giant Shield Knight** |
| 2 | **Drowned Sewers** | Water slows you unless you dash/slide; bounce off pipes | Guardian: **Sludge Brute** → then the **Class Shrine** |
| 3 | **Clockwork Tower** | Moving gears, platforms on timers, vertical climb | **BIG BOSS: The Clockmaker** (mid-run) |
| 4 | **Crimson Forest** | Grapple points, tree-top routes vs ground route | Guardian: **Elder Stag** |
| 5 | **Frozen Mines** | Ice keeps your momentum, minecart section | Guardian: **Ice Golem** |
| 6 | **The Sunken Throne** | Mix of everything, hardest enemies | **FINAL BOSS: The Drowned King** |

### 7.1 How one stage is built (template)
Each stage is about 8 sections chained together:

1. **Start**: short run-in, a free weapon or Lucky Block
2. **Combat stretch**: groups of enemies on flat ground
3. **Traversal**: platforming using the world's gimmick
4. **Branch**: main path vs side path (key or chest) vs **skip route** (hard movement, saves time)
5. **Arena**: doors lock, wave of enemies (fast kills = faster exit, and a big flask refill). Possible roaming boss spot.
6. **Traversal 2**: harder version of section 3
7. **Loot area**: key chest, cursed chest or timed door (optional)
8. **Shop room** → **Boss door**

Each stage has about: 3–4 Lucky Blocks, 2 free loot spots, 2 keys, 3 locked key chests, 1 cursed chest. That's fewer keys than locked chests, so you pick which chests to open. A Thief's Lockpick gets them one extra.

### 7.2 Routes
- **Main path**: always clear where to go (arrows/lighting). Never lost.
- **Side paths**: keys and chests, cost 10–30s detour. Worth it or not? That's the speedrun choice.
- **Skip routes**: need good movement or a specific ability (Grapple, Blink). Save time.

### 7.3 Boss types

| Type | Where | What it is | Loot |
|---|---|---|---|
| **Guardian** | End of Worlds 1, 2, 4, 5 | A giant, stronger version of one of that world's regular enemies, with 1–2 new attacks. Short fight (~30–60s). | 1 weapon at key-chest odds + full flask |
| **Big boss (mid)** | End of World 3 | A real boss with its own design, 2 phases (~60–90s) | 1 weapon, **B grade or better** + full flask |
| **Big boss (final)** | End of World 6 | Final boss, 3 phases | Ends the run |
| **Roaming boss** | Can show up in **any stage** (~15% chance per stage), in an arena next to the main path | Each one comes from a specific biome but can appear anywhere. **Optional**: skip it to save time, or fight it for great loot. | 1 weapon, **A grade or better**, with that boss's element + full flask |

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

## 8. Loot

### 8.1 Weapon grades (F → C → B → A → S)
Every weapon drops with a grade. It's the **same weapon, upgraded**: more damage, plus powers at higher grades.

| Grade | Color | Damage | Power |
|---|---|---|---|
| **F** | Gray | 80% | Nothing |
| **C** | Green | 100% | Nothing (Mage: gets an element) |
| **B** | Blue | 125% | 1 element (fire, ice, lightning, poison, or wind) |
| **A** | Purple | 160% | Stronger element + 1 bonus perk (faster attacks, crit chance, lifesteal, etc.) |
| **S** | Gold | 200% | Max-strength element + perk + a **signature move** and its own name |

S-grade example: a fire Greatsword becomes **"Sunbreaker"**, and its 3rd hit sends a wave of fire along the ground. An ice Katana becomes **"Glacier Fang"**, and its dash-slash freezes everything it passes.

The grade color shows on the item and in the swap popup, so you can tell in a split second if it's better. The popup also shows a class icon if it's one of your class weapons.

### 8.2 Elements

| Element | What it does |
|---|---|
| **Fire** | Burns enemies over time; burning enemies spread fire when they die |
| **Ice** | Slows enemies; enough hits freezes them; hitting a frozen enemy shatters it for big damage |
| **Lightning** | Each hit jumps to 2 nearby enemies |
| **Poison** | Stacks damage over time; more hits = more stacks |
| **Wind** | Big knockback, and **every kill refunds your dash** (the speed element) |

### 8.3 Grade odds

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

Weapon drops lean toward your class: about **60% of drops are your class's weapons**, and 40% are anything. After you combine, it's split between both classes.

### 8.4 Chest types

| Chest | What you get | Catch |
|---|---|---|
| **Free loot** | A weapon (on a stand, or in an open chest) | None |
| **Lucky Block** | A random **buff or debuff** | It's a gamble (8.5) |
| **Key chest** | Choose 1 of 2 weapons | Needs a key (8.7) |
| **Cursed chest** | A high-grade weapon + lots of gold | A curse (8.6) |
| **Timed chest** | A weapon | Behind a timed door (6.3) |

- Opening is **instant**, with no long animation.
- Items pop out and you swap with one button, with a quick compare popup (grade color + damage).

### 8.5 Lucky Block
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
| **Bloodrush** | Kills fill the flask double | **Dry Flask** | Flask can't be used |
| **Jackpot** (rare) | Drops an A or S weapon | **Butterfingers** | Weapon 2 is locked |

### 8.6 Cursed chest
- Drops a high-grade weapon (see odds in 8.3) and lots of gold.
- **Curse: you die in one hit until you kill 10 enemies.** A counter shows how many kills are left.
- Optional extra curses for variety later. All of them also lift after 10 kills: **No Heal** (can't drink the flask), **Heavy Feet** (no double jump), **Hunted** (enemies are faster). Cut these if you only want the one curse.

### 8.7 Keys
- Locked key chests need a key. **1 key opens 1 chest.**
- Keys are **a little further through the level**: at the end of a side path, after a hard jump section, or dropped by elite enemies.
- You can carry up to 3 keys. Leftover keys carry over to the next world.
- Shops sometimes sell a key. Thieves get 1 free chest per world with Lockpick (4.2).

---

## 9. Shops

- **One shop per world**, in the room right before the boss.
- Sometimes a **wandering merchant** mid-stage (random, rare stock).
- Shop sells: 3 weapons/abilities (using that world's odds, at least one is **B or better** and at least one is a class weapon), flask upgrade (+1 charge), an expensive instant flask refill, 1 stat upgrade, sometimes a key, and a reroll (gets pricier).
- Buying is **walk up + press one button**. No menus. Fast.
- **Gold** comes from enemies + chests, and resets every run.

---

## 10. Progression

### 10.1 Inside a run
- Weapons and abilities you find (swap anytime). Grades go up as you go deeper (8.3).
- Stat upgrades after each end-of-world boss: pick 1 of 3 (+damage, +HP, +speed, +cooldown, Bloodthirst, etc.).
- Class combining after World 2 (4.3).
- Enemies get tougher each world, so finding higher grades matters.

### 10.2 Between runs (light meta)
- All 4 classes are unlocked from the start.
- Sometimes enemies drop **blueprints** that unlock a new weapon or ability into the loot pool.
- **No permanent stat boosts**, so runs are always fair to compare for speedrunning.
- A "hybrids discovered" page fills in as you try each combo. Unlock new starting weapon choices and cosmetic outfits from achievements.
- Best times are saved **per class and per hybrid**, so each one gets its own speedrun leaderboard.

---

## 11. Controls (default)

| Action | Keyboard | Controller |
|---|---|---|
| Move | A / D (or arrows) | Left stick |
| Jump | Space | A |
| Dash | Shift | RB |
| Weapon 1 / Weapon 2 | J / K | X / Y |
| Ability 1 / Ability 2 | U / I | LT / RT |
| Heal (flask) | Q | LB |
| Interact / swap | E | B |
| Instant restart | R (hold) | Select (hold) |

All rebindable. Classes don't add any buttons (passives are always on).

---

## 12. Look and sound
- Pixel art, 2D side view. Each world has its own color palette so you always know where you are.
- Each class has its own look, and the hybrid gets a mixed outfit after the Class Shrine.
- **Game feel** is a priority: hit-stop on big hits, screen shake, enemy flash, punchy sounds.
- Each element has its own look and sound (fire crackle, ice shatter, etc.).
- Flask fill bar ticks up with a little sound on every kill, so you feel the heal coming.
- Music speeds up / adds layers with Rush level.
- Start with simple placeholder shapes, add real art after the game feels good.

---

## 13. Tech

**Recommended:** **Phaser 3 + TypeScript + Vite**, levels made in **Tiled** (free map editor).
- Runs in any browser: share a link, upload to itch.io, no install.
- I can build, run, and test it directly in this setup.
- Tiled makes hand-building the 6 stages easy.

**Alternative:** **Godot 4**. It's a free engine, very good for 2D, with a visual editor you'd use yourself. Better if you want to do a lot of the editing by hand; it needs an install.

Planned code layout (Phaser):
```
src/
  main.ts             game setup
  scenes/             Boot, Menu, ClassSelect, World, Shop, ClassShrine, Boss, RunSummary
  player/             movement, combat, loadout, flask
  classes/            4 classes, 6 hybrids, 4 masters (data tables + passives)
  weapons/ abilities/ one file per item + shared data tables
  loot/               grades, elements, odds tables, chests, Lucky Block, keys
  enemies/ bosses/    regular enemies, Guardians, big bosses, roaming bosses
  systems/            rush meter, timer/splits, save data
  levels/             Tiled JSON per world
assets/               sprites, sounds, music
```

---

## 14. Build order (milestones)

Each milestone ends with something you can play.

| M | Goal | You can play… |
|---|---|---|
| M0 | Project setup | An empty screen with a square you can move |
| M1 | **Movement feel** | A grey test level with all moves from section 3 |
| M2 | **Combat core** | 2 weapons (Greatsword + Daggers), 2 enemy types, HP, flask that refills from kills, death, restart |
| M3 | **World 1 stage** (grey boxes) | Full Ashen Gate stage start to end, timer + splits |
| M4 | **Loot** | Grades F–S, elements, free loot, Lucky Blocks, keys + key chests, cursed chest, shop, 2 abilities + Vampire |
| M5 | **First Guardian** | Giant Shield Knight fight |
| M6 | **Classes + run structure** | Class select with all 4 classes (passives + at least 2 weapons each), World → upgrade pick → next world, run summary, PB saving, instant restart |
| M7 | **Worlds 2–3 + mid boss** | Class Shrine + all hybrids, Clockmaker fight, more weapons/abilities/enemies, Rush meter, timed doors, first roaming boss |
| M8 | **Art + sound pass** | Worlds 1–3 look and sound real, class outfits |
| M9 | **Worlds 4–6** | Full game, final boss, all 4 roaming bosses, all weapons |
| M10 | **Speedrun extras + polish** | Seeds, practice mode, ghosts, per-class leaderboards, balance |

**First thing to make fun: M1.** If running and jumping around the empty test level isn't fun, nothing else will be.

---

## 15. Questions for you

**New from v3**
1. When do you combine classes? I put it **after World 2**. Other options: pick both classes at the very start, or combine after the mid-boss (World 3).
2. Can any class use any weapon (class weapons just get +25%)? Or should classes be **locked** to their own weapons?
3. **Vampire**: a button ability with a cooldown (what I wrote), or an always-on passive?
4. Want more than 4 classes (e.g. Paladin, Necromancer), or keep it at 4 for now?

**From v2**

5. Grades are **F, C, B, A, S** (no D). Want a D too?
6. Grades only for **weapons**, or abilities too?
7. Roaming bosses: one from each biome that can randomly show up in any stage. Right?
8. Lucky Block at **55% buff / 45% debuff**. Okay, or 50/50?

**Still open from v1**

9. Die = restart whole run, or just restart the current world? (A2)
10. Same layouts every run (speedrun-friendly) or random layouts? (A4)
11. 6 worlds okay? More/fewer?
12. Phaser (browser) or Godot?
13. Art: will you draw it, or should I use placeholder + free asset packs?
14. Name: keep "RUSHBLADE" as a working title, or something else?
