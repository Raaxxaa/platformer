# Game Plan — Speedrun Action Platformer (working title: **RUSHBLADE**)

> Draft v1. Read it over and mark anything you want changed. Every section is
> numbered so you can say things like "change 5.2" or "cut section 9".

---

## 0. Things I assumed (check these first)

| # | My assumption | Change it if wrong |
|---|---|---|
| A1 | "deadsouls" means **Dead Cells** (2D side-view action platformer with big weapons, skills, chests, shops). If you meant **Dark Souls** (3D, slow, stamina) the plan changes a lot. | |
| A2 | It's a **roguelite**: if you die, the run restarts from World 1. | Could be "restart the world" instead |
| A3 | **6 worlds**, each world is **one stage** that ends in a boss. | Number of worlds |
| A4 | Stage layouts are **hand-made and the same every run** (so speedrunners can learn routes). Only loot is random. | Could be random layouts like Dead Cells |
| A5 | **Pixel art**, 2D, side view. | |
| A6 | Plays on **PC in the browser**, keyboard or controller. | |
| A7 | Single player only. | |

---

## 1. The pitch

Dead Cells–style combat and loot, but built around **going fast**. You carry
big weapons and cooldown abilities, cut through each world in one continuous
stage, grab chests and hit shops on the way, and fight the world's boss at the
end. A timer is always on screen. Good players get faster by learning the
stage, picking better builds, and chaining movement and attacks without
stopping.

**Run length targets**

| | One world | Full run (6 worlds) |
|---|---|---|
| First time playing | 4–6 min | 30–40 min |
| Average player who knows it | 2.5–3.5 min | 15–20 min |
| Good speedrunner | ~1:30 | ~9–10 min |

That's what "medium long" means in this plan — tell me if you want it longer or shorter.

---

## 2. Core loop

1. Start run → pick a starting weapon (from 3 random).
2. Play through the world's stage: kill, move, grab chests, decide on detours.
3. Shop room before the boss door → spend gold.
4. Beat the boss → world split time shows (green = faster than your best, red = slower).
5. Short transition (pick 1 of 3 stat upgrades) → next world.
6. Beat World 6 boss → run time, summary screen, personal best saved.
7. Die → instant restart from World 1 (one button, no menus).

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

### 4.1 Loadout (same as Dead Cells)
- **2 weapon slots** — any mix of melee, ranged, or shield.
- **2 ability slots** — cooldown skills.
- **1 heal flask** — 2 charges, refilled at shops. Drinking it is fast (~0.4s) so it doesn't kill the pace.

### 4.2 Weapons (starting list, ~12 for first version)

| Weapon | Feel | Special |
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
| Grapple Hook | Pull yourself to walls/enemies — big movement skill |
| Blink | Teleport a short distance, even through thin walls |
| Shockwave | Ground blast, knocks enemies up |
| Bomb | Throw, explodes, can bomb-jump |
| Frost Burst | Freeze enemies around you |
| Turret | Drop a turret that shoots for 8s |
| Spinning Blades | Saws orbit you for a few seconds |
| Time Slow | Slow everything except you for 3s |

### 4.4 Enemies
- Regular enemies **die fast** (2–4 hits from a good weapon). No damage sponges — they're things to cut through, not walls.
- Each world has 4–5 enemy types + 1 elite version.
- Enemies get stunned/staggered easily so you can push through.
- Clear warning flash before every attack.

### 4.5 Bosses
- One boss per world, ~60–90 seconds for an average player.
- Bosses have **stagger phases**: hit them hard enough and they drop — big damage window. Fast players skip phases.

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
- Timer pauses only in menus — **not** in shops (shopping costs time, that's the point).

### 5.3 Timed doors
- Some chest rooms are behind a door that **only opens if you reach it under a time limit** (like Dead Cells). Rewards: rare weapons, big gold.

### 5.4 Quality-of-life for speedrunners
- One-button instant restart.
- **Seeded runs**: type a seed to get the same loot every time (for races).
- **World Practice mode**: play any world you've reached, timed, with a preset loadout.
- Ghost replay of your best world time (later milestone).

---

## 6. Worlds

Every world = **one continuous stage** → shop room → boss.

| # | World | Gimmick | Boss |
|---|---|---|---|
| 1 | **Ashen Gate** (castle walls) | Teaches dash, wall jump, slide | The Gatekeeper (big knight) |
| 2 | **Drowned Sewers** | Water slows you unless you dash/slide; bounce off pipes | Sludge Mother |
| 3 | **Clockwork Tower** | Moving gears, platforms on timers, vertical climb | The Clockmaker |
| 4 | **Crimson Forest** | Grapple points, tree-top routes vs ground route | Antlered Beast |
| 5 | **Frozen Mines** | Ice keeps your momentum, minecart section | Mine Golem |
| 6 | **The Sunken Throne** | Mix of everything, hardest enemies | The King (2 phases) |

### 6.1 How one stage is built (template)
Each stage is about 8 sections chained together:

1. **Start** — short run-in, sometimes a free chest
2. **Combat stretch** — groups of enemies on flat ground
3. **Traversal** — platforming using the world's gimmick
4. **Branch** — main path vs side room (chest) vs **skip route** (hard movement, saves time)
5. **Arena** — doors lock, wave of enemies (fast kills = faster exit)
6. **Traversal 2** — harder version of section 3
7. **Timed door / cursed chest area** (optional)
8. **Shop room** → **Boss door**

### 6.2 Routes
- **Main path**: always clear where to go (arrows/lighting). Never lost.
- **Side rooms**: chests, cost 10–30s detour. Worth it or not? That's the speedrun choice.
- **Skip routes**: need good movement or a specific ability (Grapple, Blink). Saves time.

---

## 7. Chests

| Chest | Contents | Catch |
|---|---|---|
| Normal | Gold or a random weapon/ability | None |
| Big chest | Better item, choose 1 of 2 | Usually in a side room (time cost) |
| Cursed chest | Rare item + lots of gold | You die in 1 hit until you kill 10 enemies |
| Timed chest | Rare item | Behind a timed door (5.3) |

- Opening is **instant** — no long animation.
- Items pop out and you swap with one button press, showing a quick stat compare.

---

## 8. Shops

- **One shop per world**, in the room right before the boss.
- Sometimes a **wandering merchant** mid-stage (random, rare stock).
- Shop sells: 3 weapons/abilities, heal flask refill, 1 stat upgrade, reroll (gets pricier).
- Buying is **walk up + press one button**. No menus. Fast.
- **Gold** comes from enemies + chests, and resets every run.

---

## 9. Progression

### 9.1 Inside a run
- Weapons/abilities you find (swap anytime).
- Stat upgrades after each boss: pick 1 of 3 (+damage, +HP, +speed, +cooldown, etc.).
- Item "tiers" get better in later worlds (World 5 weapons are stronger than World 1's).

### 9.2 Between runs (light meta)
- Sometimes enemies drop **blueprints** → unlock a new weapon/ability into the loot pool.
- **No permanent stat boosts** — so a run is always fair to compare for speedrunning.
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
- Music speeds up / adds layers with Rush level.
- Start with simple placeholder shapes, add real art after the game feels good.

---

## 12. Tech

**Recommended:** **Phaser 3 + TypeScript + Vite**, levels made in **Tiled** (free map editor).
- Runs in any browser — share a link, upload to itch.io, no install.
- I can build, run, and test it directly in this setup.
- Tiled makes hand-building the 6 stages easy.

**Alternative:** **Godot 4** — free engine, very good for 2D, has a visual editor you'd use yourself. Better if you want to do a lot of the editing by hand; needs an install.

Planned code layout (Phaser):
```
src/
  main.ts             game setup
  scenes/             Boot, Menu, World, Shop, Boss, RunSummary
  player/             movement, combat, loadout
  weapons/ abilities/ one file per item + shared data tables
  enemies/ bosses/
  systems/            rush meter, timer/splits, loot, save data
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
| M4 | **Loot** | Gold, chests (normal/big/cursed), shop room, 2 abilities |
| M5 | **First boss** | The Gatekeeper fight |
| M6 | **Run structure** | World → upgrade pick → next world, run summary, PB saving, instant restart |
| M7 | **Worlds 2–3** | More weapons/abilities/enemies, Rush meter, timed doors |
| M8 | **Art + sound pass** | Worlds 1–3 look and sound real |
| M9 | **Worlds 4–6** | Full game, final boss |
| M10 | **Speedrun extras + polish** | Seeds, practice mode, ghosts, balance |

**First thing to make fun: M1.** If running and jumping around the empty test level isn't fun, nothing else will be.

---

## 14. Questions for you

1. Dead Cells or Dark Souls? (A1)
2. Die = restart whole run, or just restart the current world?
3. Same layouts every run (speedrun-friendly) or random layouts?
4. 6 worlds okay? More/fewer?
5. Phaser (browser) or Godot?
6. Any weapons/abilities/worlds you definitely want, or want cut?
7. Do you have art in mind / will you draw it, or should I use placeholder + free asset packs?
8. Name — keep "RUSHBLADE" as a working title or something else?
