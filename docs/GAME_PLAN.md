# Game Plan — Speedrun Action Platformer (working title: **RUSHBLADE**)

> Draft v8. Read it over and mark anything you want changed. Every section is
> numbered so you can say things like "change 6.2" or "cut section 10".

### What changed in v9 (from playtesting with friends)
- **Training Yard tutorial:** next to the Home Village, 17 stations teach every move, combat basic and speed technique on dummies. You can't die there → 9.3
- **Gentler Stage 1 start:** the first fights come one small group at a time (max 2 enemies, never two groups on screen together). Same enemies, more space → 7.5, `docs/levels/plains.md`

### What changed in v8
- **Engine decided: Phaser 4.2.1** (TypeScript, runs in the browser). It was the only engine I could build, run and screenshot end to end here → 13
- **Art decided: original pixel art drawn in code by Claude.** You approve a style board before mass production → 12
- **How we work:** this chat designs and writes the instructions; a separate build chat builds code, UI, art and sound from them → 13.1
- **The exact build spec now exists** in `docs/spec/` (every number and rule). The spec wins over this plan on numbers
- From the spec review: regular enemies get tougher more slowly than bosses in later stages, so they keep dying in 2–4 hits; the **Enemy King's HP was lowered** to keep a full speedrun near 8 minutes; Bloodthirst can be picked up to 3 times
- **Outfit unlocks moved to later** (not in the first version) → 10.2

### What changed in v7 (from your notes)
- **For now: no online features, no co-op, one platform (PC)** → 0
- **New journey:** you travel to the enemy kingdom. A run is **4 stages** with a fork: Plains & Forest → **Caves & Mountains or Dark Forest & Swamps** → Enemy Kingdom → King's Castle → 7.1, 7.2
- **Dragon special event:** shows up in **30% of runs** and drops great loot. It replaces the 4 roaming bosses (the Dragon comes in 4 elements instead) → 7.4
- **Every biome has its own mobs** → 7.3
- **Villages between stages:** shop there, then **sleep at the inn** to restore HP and start the next stage → 9.1
- **Abilities:** you carry only 2. Everything you find or buy is **Level 1**. You level them up at village shops (up to **Lv5**) and can **sell** them. Prices depend on the level → 5.5, 9.3
- Grade odds are now per stage (4 stages instead of 6 worlds) → 8.3

### From v6
- The heavy hitter class is called **Tank**. It can use both hammers: its own War Maul and the Wizard's Storm Hammer (slower 5s throw recharge without a Wizard ability) → 4.2

---

## 0. Decided vs. still assumed

**Decided**
- Dead Cells–style 2D side-view action platformer, built for speed.
- Has its own ideas, so it's not a copy: ability-based classes with Connection bonuses and hybrids, weapon grades + elements, ability levels you buy, kill-charged flask, Lucky Blocks, Guardians, the Dragon event, villages between stages, Rush meter.
- 4 classes: Swordsman, Tank, Archer, Wizard. Thief is a hybrid (Swordsman + Archer), not a class. Any class can use any weapon.
- A run is 4 stages with a fork after Stage 1, and a village between every stage.
- **For now:** single player only, no online features (scores are saved on your computer), one platform (PC), keyboard or controller. Whether it runs in the browser or as an installed game depends on the engine choice (15.1 #1).

**Still my assumptions. Change any of these:**

| # | My assumption | Other option |
|---|---|---|
| A2 | It's a **roguelite**: if you die, the run restarts from Stage 1. | Restart only the current stage |
| A4 | **For now:** stage layouts are hand-made and the same every run. **Later (decided):** layouts change a little every run, Dead Cells style. See 14.1 | — |
| A5 | **Pixel art**, 2D, side view. | |

---

## 1. The pitch

Dead Cells–style combat and loot, but built around **going fast**. You set out
from your home village on the road to the enemy kingdom to take down its King.
Pick a starting class, then build your character from the weapons and
abilities you find. Two abilities from the same class connect and get
stronger; two from different classes turn you into a hybrid with a new
playstyle. Each stage is one leg of the journey: one big biome, one boss, then
a village to shop and sleep before the next leg. Pick your road at the
crossroads, and maybe run into a dragon. A timer is always on screen.

### 1.1 Story
- You start in your **home village** and travel to the **enemy kingdom** to defeat its **King**.
- The journey: **Plains & Forest** → **Caves & Mountains** *or* **Dark Forest & Swamps** → **Enemy Kingdom** → **King's Castle**.
- Villages along the road are where you rest, shop, and pick your route.
- Why you're in a hurry is still open (see 15.2).

### 1.2 Run length targets

| | One stage | Full run (4 stages + villages) |
|---|---|---|
| First time playing | 5–7 min | 25–35 min |
| Average player who knows it | 3–4 min | 13–18 min |
| Good speedrunner | ~1:45 | ~7–8 min |

---

## 2. Core loop

1. Start in your **home village** → **pick a starting class** → get its starting ability (Lv1) and pick its starting weapon (1 of 2, C grade). Walk out the gate.
2. Play through the stage: kill (this also refills your flask), move, hit Lucky Blocks, grab keys, open chests, decide on detours.
3. Every ability you pick up shapes your class: stay pure for a **Connection bonus**, or mix for a **hybrid**.
4. If this run has the **Dragon**, it shows up in Stage 2 or 3. Fight it for top loot, or skip it to save time.
5. Beat the stage's boss → stage split time shows (green = faster than your best, red = slower) → pick 1 of 3 stat upgrades.
6. Arrive at a **village**: shop, upgrade or sell abilities, then **sleep at the inn** to restore your HP and start the next stage. After Stage 1, choose your road.
7. Beat the King in Stage 4 → run time, summary screen, personal best saved.
8. Die → instant restart from Stage 1 with the same class (one button, no menus).

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
- **Every weapon and every ability belongs to a class**, except **Vampire**, which is **neutral** and doesn't belong to any class (more neutral abilities may come later).
- In your home village you pick a **starting class**. You get its starting ability (Lv1) and pick 1 of 2 starting weapons (C grade). Your second ability slot starts empty.
- After that, **your class is whatever your 2 abilities are.** Pick up abilities from other classes to combine classes. The HUD shows your current class name (e.g. "Tank", or "Thief" for the Swordsman + Archer hybrid).
- **Any class can use any weapon.** Weapons that match your class just work better (4.4).

### 4.2 The four classes

| Class | Style | Weapons | Abilities |
|---|---|---|---|
| **Swordsman** | Blades, fast combos, precise | Greatsword, Katana, Twin Daggers, Spear, Scythe | Blade Dash, Whirlwind, Blade Flurry, Riposte |
| **Tank** | Heavy hitter. Slow, huge hits, tanky | **War Maul** (big hammer), **Iron Fists**, Giant Axe, Flail, Shield, Storm Hammer (shared with Wizard) | Shockwave, Shoulder Charge, Rage, Boulder Toss |
| **Archer** | Ranged, mobile | Bow, Crossbow, Hand Cannon, Javelin, Throwing Knives | Arrow Rain, Turret, Grapple Arrow, Hunter's Mark |
| **Wizard** | Storm magic, Thor-style | **Storm Hammer** (shared with Tank), Staff, Wand, Spell Tome | Thunder Strike, Frost Burst, Blink, Time Slow |

**Two hammers, two styles:** the Tank's **War Maul** is pure weight: slow, huge ground smashes. The Wizard's **Storm Hammer** is a magic hammer you throw and call back with lightning.
- The Tank can use **both**. The Storm Hammer counts as a class weapon for the Tank and the Wizard, so it gets the +25% match bonus with either class's abilities (4.4).
- **Throw recharge:** after you throw the Storm Hammer, it takes **2s** before you can throw it again if you carry a Wizard ability, and **5s** for everyone else (including a pure Tank). Swinging it has no recharge.
- Carry a Tank ability and a Wizard ability and you become the **Thunderlord** (4.3): War Maul in one hand, Storm Hammer in the other, with the fast 2s recharge.

**Starting kits**

| Starting class | Starting ability | Starting weapon (pick 1) |
|---|---|---|
| Swordsman | Blade Dash | Greatsword or Katana |
| Tank | Shockwave | War Maul or Iron Fists |
| Archer | Arrow Rain | Bow or Crossbow |
| Wizard | Thunder Strike | Storm Hammer or Staff |

### 4.3 Ability pairs: Connection bonus or hybrid
Your 2 ability slots decide what you are:

| Your 2 abilities | What you get | Feel |
|---|---|---|
| **Same class** (e.g. 2 Wizard abilities) | **Connection bonus**: the class's bond passive turns on, **and** the two abilities link: use one, then the other within 3s, and the second one is **50% stronger** | Strongest, most focused |
| **Different classes** (e.g. Archer + Wizard) | **Hybrid**: a new class name and a combo perk that changes how you play | Not stronger, just different. More playstyles |
| **Neutral + anything** (e.g. Vampire + Blink) | No bond or hybrid. That's the price for Vampire's healing | Safe |

**Connection bonuses (same class)**

| Class | Bond passive |
|---|---|
| **Swordsman: Blademaster** | Every 3rd hit in a row is a guaranteed crit, and kills reset your dash cooldown |
| **Tank: Iron Will** | +30% max HP, you can't be knocked back while attacking, and heavy hits stagger enemies twice as long |
| **Archer: Eagle Eye** | Long-range hits always crit. Aiming in the air slows your fall so you can shoot mid-jump |
| **Wizard: Storm Caller** | Abilities recharge 25% faster, elements are stronger, and C-grade weapons get an element too (normally only B and up do) |

**Hybrids (different classes)**

| Abilities from | Hybrid | Combo perk |
|---|---|---|
| Swordsman + Archer | **Thief** | **Silent Steps:** +20% move speed, enemies take longer to notice you, and your first hit on an enemy that hasn't noticed you is a crit. **Lockpick:** open 1 key chest per stage without a key |
| Swordsman + Tank | **Gladiator** | Switching weapons mid-combo keeps the combo going, and the next hit does +50% |
| Swordsman + Wizard | **Spellblade** | Every melee hit makes your abilities recharge 0.5s faster |
| Tank + Archer | **Warden** | Melee hit → next shot does +50%. Shot hit → next melee hit does +50% |
| Tank + Wizard | **Thunderlord** | Every heavy hit (hammer, axe, fist finisher) calls down a lightning bolt. The full Thor combo |
| Archer + Wizard | **Arcane Archer** | Every arrow carries an element (even F-grade bows), and charged shots explode |

### 4.4 Weapon match
- If a weapon's class **matches the class of either of your abilities**, it gets **+25% damage** and its class icon lights up on the HUD.
- If it doesn't match, it **still works normally**. It just doesn't get the bonus.
- Examples:
  - Bow + Arrow Rain → Bow is matched (+25%).
  - Bow + Thunder Strike → Bow works fine, no bonus.
  - Bow + Arrow Rain + Thunder Strike → you're an **Arcane Archer**, and the Bow is matched.

### 4.5 Your character's look (not tied to class)
Your character's appearance has **nothing to do with your class**. Any class can look any way you want.

- **Character creator** (a mirror/wardrobe in the Home Village):
  - **Race:** Human, Elf (pointed ears), Dwarf (beard, stocky) or Orc (green skin, small tusks).
  - **Looks:** skin tone, hair style, hair color, face, beard.
  - **Clothes:** a few starting clothing sets, each with **colors you pick**.
- **Accessories from every mob (cosmetics only):** every enemy type has its own accessory (hats, helmets, masks, capes, pauldrons…), themed by who it came from. **The first time you kill an enemy type, you get its accessory**, always. Examples:

  | Enemy | Accessory |
  |---|---|
  | Wolf | Wolf-pelt hood |
  | Bandit | Bandit bandana |
  | Bandit Archer | Feathered cap |
  | Wild Boar | Tusk necklace |
  | Bandit Brute | Spiked shoulder pads |
  | Great Boar | Boar-skull helmet |
  | Dragon (each color) | Dragon-scale cape in that color |

  - That's about 30 enemy types, so about 30 accessories to collect over many runs.
  - They're **kept forever** in your collection, take no inventory slot, and a popup says what you got.
  - **Collection book:** shows every accessory you've found and outlines of the ones still missing.
  - **Shops sell cosmetics too:** every village shop has **1 cosmetic slot** with a shop-only item (clothing colors, hats, capes, hair dyes that no enemy drops). It changes every visit and costs run gold (roughly 150–400). So you choose: spend gold on looks and stay weaker this run, or on power. It's kept forever, like drops.
  - **Possible extra later:** a rare color variant of each accessory with a small chance on later kills, for players who want more to hunt.
- **Your class still shows:** a thin glow or trim in your current class or hybrid color, so you can still tell your class at a glance.
- **Fairness:** every race is the same size and has the same hitbox, and everything here is **looks only, with no stats**. That keeps speedrun times comparable.
- **When:** a later milestone (M12). Until then the player uses the 4 starter looks from the art plan, and any class can use any of them.

---

## 5. Combat

### 5.1 Loadout
- **2 weapon slots**: any mix of melee, ranged, magic, or shield.
- **2 ability slots**: these decide your class (4.3). You can never carry more than 2 abilities.
- **Heal flask**: see 5.2.

### 5.2 Healing: the flask recharges from kills
- The flask has **2 charges** to start. Each charge heals 40% HP. Drinking is fast (~0.4s).
- Under the flask icon is a **fill bar**. **Kills fill it**, and at 100% you get 1 charge back.

| Source | Fills per kill |
|---|---|
| Regular enemy | 5% (20 kills = 1 charge) |
| Elite enemy | 15% |
| Guardian / big boss / Dragon | Refills the whole flask |
| **Vampire** (neutral ability, 5.4) | **+2%** extra per kill at Lv1, rising to **+3%** at Lv3 and **+5%** at Lv5 |
| Scythe | +3% extra per kill made with it |
| Bloodthirst stat upgrade | +2% extra per kill |

- With everything stacked (Vampire Lv5 + Scythe + Bloodthirst taken 3 times) it's 19% per kill, about 6 kills per charge.
- You start every run with a full flask.
- **Sleeping at a village inn restores all your HP, but not the flask.** The flask only refills from kills, so you have to keep killing.
- Village shops sell a **flask upgrade** (+1 max charge, up to 4) and an expensive instant refill (9.3).

### 5.3 Weapons (first version, 19)
Every weapon can drop at any grade (F to S). See section 8.1 for what grades do.

**Swordsman**

| Weapon | Feel | Special |
|---|---|---|
| Greatsword | Big, wide swings | 3rd hit of combo is a huge cleave |
| Katana | Fast + big | Hold to charge a dash-slash that goes through enemies |
| Twin Daggers | Super fast | Crits from behind |
| Spear | Long reach | Attack while dashing = lunge through enemies |
| Scythe | Big arc | Kills with it fill the flask +3% |

**Tank**

| Weapon | Feel | Special |
|---|---|---|
| **War Maul** | Huge hammer, slowest swings in the game | Dive slam makes a shockwave that knocks down everything nearby |
| **Iron Fists** | Fast punch combos | Combo finisher is an uppercut that launches you upward too |
| Giant Axe | Very heavy | Spin attack while moving |
| Flail | Ball on a chain, mid-range | Wind it up, then let go for a huge hit that pulls small enemies in |
| Shield | Defense | Perfect parry stuns and refunds dash |

**Archer**

| Weapon | Feel | Special |
|---|---|---|
| Bow | Ranged | Charged shot pierces |
| Crossbow | Slow, heavy bolts | Bolts pin enemies to walls |
| Hand Cannon | Ranged, slow | Knocks you backward (movement tech!) |
| Javelin | Heavy throw | Sticks in walls, and you can stand on it (movement tech!) |
| Throwing Knives | Fast ranged | Throws 3 at once, never runs out |

**Wizard**

| Weapon | Feel | Special |
|---|---|---|
| **Storm Hammer** | Thor-style hammer (also a Tank weapon) | Swing it, or throw it and it flies back to you, hitting on the way out and back. Throw recharge: 2s with a Wizard ability, 5s otherwise. Dive slam with it calls down lightning |
| Staff | Magic bolts | Hold to charge a big exploding orb |
| Wand | Rapid small shots | Shots slightly home in on enemies |
| Spell Tome | Close-range magic | Opens a ring of spinning runes around you |

**Speed twist on big weapons:** heavy weapons get **faster while your Rush meter is high** (see 6.1), so big weapons reward staying aggressive.

### 5.4 Abilities (first version, 17)
Every ability starts at **Lv1** and can be upgraded up to **Lv5** (5.5). The last column says what upgrading improves.

**Swordsman**

| Ability | What it does (Lv1) | Upgrading to Lv5 |
|---|---|---|
| Blade Dash | An extra dash that slices through every enemy in its path | More damage; 2 charges at Lv5 |
| Whirlwind | Spin forward through enemies | Longer spin; pulls enemies in at Lv5 |
| Blade Flurry | Swords spin around you for a few seconds | More blades, lasts longer |
| Riposte | Stance for 1s: if you get hit, block it and counter with a big slash | Wider counter; also refunds your dash at Lv5 |

**Tank**

| Ability | What it does (Lv1) | Upgrading to Lv5 |
|---|---|---|
| Shockwave | Ground slam that knocks enemies up | Bigger area, more damage |
| Shoulder Charge | Charge forward, knocking enemies aside. Breaks cracked walls (shortcuts!) | Goes farther; stuns at Lv5 |
| Rage | For 6s: +30% damage and you can't be staggered | Up to +60% damage at Lv5 |
| Boulder Toss | Rip a boulder out of the ground and throw it | Bigger boulder; shatters into pieces at Lv5 |

**Archer**

| Ability | What it does (Lv1) | Upgrading to Lv5 |
|---|---|---|
| Arrow Rain | Rain of arrows on the area ahead of you | More arrows, wider area |
| Turret | Drop a ballista that shoots for 8s | Shoots faster; drops 2 at Lv5 |
| Grapple Arrow | Rope arrow that pulls you to walls or pulls enemies to you | Longer range, faster pull |
| Hunter's Mark | Marks the strongest enemy nearby: it takes +30% damage | Marks more enemies (3 at Lv5) |

**Wizard**

| Ability | What it does (Lv1) | Upgrading to Lv5 |
|---|---|---|
| Thunder Strike | Calls lightning down on enemies in front of you (Thor-style) | More bolts |
| Frost Burst | Freeze enemies around you | Bigger area, longer freeze |
| Blink | Teleport a short distance, even through thin walls | Goes farther; 2 charges at Lv5 |
| Time Slow | Slow everything except you for 3s | Up to 5s at Lv5 |

**Neutral (no class)**

| Ability | What it does (Lv1) | Upgrading to Lv5 |
|---|---|---|
| **Vampire** | Always on, no button. Every kill fills the flask **+2%** extra | +2% → +2.5% → +3% → +4% → **+5%** at Lv5 |

### 5.5 Abilities: slots, levels and selling
- **You can only carry 2 abilities.** Picking up a new one means swapping one out; the old one drops on the ground (it keeps its level, so you can pick it back up).
- **Every ability you find or buy is Lv1.** It doesn't matter what level your current abilities are: a new Archer ability is Lv1 even if your other Archer ability is Lv5.
- **Upgrading:** pay gold at a village shop (or the wandering merchant) to raise one of your abilities by 1 level, up to **Lv5**. Each level costs more than the last (9.3).
- **Selling:** sell one of your abilities at a village shop. The higher its level, the more gold you get back. Use that gold to buy a different ability or upgrade your other one.
- So every village is a choice: **keep investing** in what you have, or **sell and switch** to a new build.
- Weapons use **grades** (F–S) and you find better ones as you go. Abilities use **levels** (1–5) and you buy them.

### 5.6 Enemies
- Regular enemies **die fast** (2–4 hits from a good weapon). No damage sponges. They're things to cut through, not walls.
- **Every biome has its own mobs:** 4 regular types + 1 elite (7.3). In the first two stages, one of them becomes that stage's Guardian (7.4).
- Elites sometimes drop a **key** (8.7) or an ability.
- Enemies get stunned/staggered easily so you can push through.
- Clear warning flash before every attack.
- Enemies get tougher each stage, so you need the better grades and levels you get later.

### 5.7 Bosses
See section 7.4.

---

## 6. Speedrun systems

### 6.1 Rush meter
- Fills from kills, combos, dash-through attacks, and not stopping.
- Drains when you stand still or get hit.
- 3 levels: each level gives more move speed, attack speed, and gold drops.
- Max Rush has a visual effect (trail, music layer) so it feels good.

### 6.2 Timer and splits
- Run timer always on screen (can be turned off).
- Split for each stage, compared to your personal best (green/red).
- Timer pauses only in menus. It **keeps running in villages**, in shops and when opening chests. Deciding costs time, that's the point.
- Villages are small (about one screen), so a fast player is through one in ~10 seconds. Sleeping at the inn is a 1-second fade.

### 6.3 Timed doors
- Some chest rooms are behind a door that **only opens if you reach it under a time limit**. Rewards: a weapon at key-chest odds (8.3) plus big gold.

### 6.4 Quality-of-life for speedrunners
- One-button instant restart.
- **Seeded runs**: type a seed to get the same loot, Lucky Blocks and Dragon every time (for races).
- **Stage Practice mode**: play any stage you've reached, timed, with a preset loadout.
- Ghost replay of your best stage time (later milestone).
- Best times are saved separately for the **Mountain road** and the **Forest road**, since they're different routes.

---

## 7. The journey: stages and bosses

### 7.1 The route

```
Home Village            (pick your class)
      |
Stage 1: Plains & Forest            -> Guardian: Great Boar
      |
Crossroads Village      (choose your road)
      |                                   |
Stage 2: Caves & Mountains      Stage 2: Dark Forest & Swamps
  -> Guardian: Stone Colossus     -> Guardian: Spider Queen
      |                                   |
Border Village          (last stop before the enemy kingdom)
      |
Stage 3: Enemy Kingdom              -> Big boss: The Black Knight
      |
Rebel Camp              (hidden camp inside the kingdom)
      |
Stage 4: King's Castle              -> Final boss: The Enemy King

Dragon event (30% of runs): shows up in Stage 2 or 3
```

- **Plains & Forest is always first.** Stage 2 is your choice of road. Stages 3 and 4 are always the Enemy Kingdom and the King's Castle.
- Each stage is **one continuous biome** and ends with its boss.

### 7.2 Biomes

| Stage | Biome | Gimmick | End boss |
|---|---|---|---|
| 1 | **Plains & Forest** | Teaches dash, wall jump, slide. Open fields, then a forest with a tree-top route vs a ground route | Guardian: **Great Boar** |
| 2 (Mountain road) | **Caves & Mountains** | Vertical climbs, falling rocks, a minecart ride through the caves, icy peaks that keep your momentum | Guardian: **Stone Colossus** |
| 2 (Forest road) | **Dark Forest & Swamps** | Swamp water slows you unless you dash or slide, dark areas lit by fireflies, vines to grapple | Guardian: **Spider Queen** |
| 3 | **Enemy Kingdom** | Town streets vs rooftop route, guards on the walls, cannons that fire across the level | Big boss: **The Black Knight** |
| 4 | **King's Castle** | Mix of everything, plus traps: spike floors, swinging blades, collapsing bridges | Final boss: **The Enemy King** |

The two Stage 2 roads are about the same length. The Mountain road has more climbing and movement tricks; the Forest road has more fighting.

### 7.3 Mobs per biome

| Biome | Regular mobs | Elite |
|---|---|---|
| **Plains & Forest** | **Wolf** (fast lunges), **Bandit** (basic sword), **Bandit Archer** (shoots from range), **Wild Boar** (charges in a straight line) | **Bandit Brute** (huge club) |
| **Caves & Mountains** | **Bat Swarm** (erratic flyers), **Goblin Miner** (throws bombs), **Rock Golem** (armored front, hit it from behind or above), **Ram** (headbutts you off ledges) | **Goblin Shaman** (shields nearby goblins) |
| **Dark Forest & Swamps** | **Bog Zombie** (rises out of the swamp), **Giant Spider** (drops from above on a thread), **Will-o'-Wisp** (floats in, explodes), **Swamp Witch** (throws poison potions) | **Treant** (walking tree, roots you in place) |
| **Enemy Kingdom** | **Soldier** (shield blocks from the front), **Crossbowman** (on walls and rooftops), **War Hound** (fast, in packs), **Battle Mage** (fireballs, teleports) | **Knight** (heavy armor) |
| **King's Castle** | **Royal Guard** (long halberd reach), **Gargoyle** (stone until you get close, then swoops), **Castle Mage** (shields other enemies), **Living Armor** (gets back up once) | **Royal Executioner** (giant axe) |

### 7.4 Bosses

| Type | Where | What it is | Loot |
|---|---|---|---|
| **Guardian** | End of Stage 1 and Stage 2 | A giant, stronger version of one of that biome's regular mobs, with 1–2 new attacks. Short fight (~30–60s) | 1 weapon at key-chest odds + full flask |
| **Big boss** | End of Stage 3 | **The Black Knight**, the King's champion. A real boss with its own design, 2 phases (~60–90s) | 1 weapon, **B grade or better** + 1 ability + full flask |
| **Final boss** | End of Stage 4 | **The Enemy King**, 3 phases | Ends the run |
| **Dragon** (special event) | Shows up in **30% of runs**, in Stage 2 or 3, landing in an arena next to the main path | A huge, fast boss. **Optional**: skip it to save time, or fight it for great loot | 1 weapon, **A grade or better**, with the Dragon's element + full flask + lots of gold |

- Guardians: **Great Boar** (giant Wild Boar), **Stone Colossus** (giant Rock Golem), **Spider Queen** (giant Giant Spider).
- The Black Knight and the Enemy King have **stagger phases**: hit them hard enough and they drop, which opens a big damage window. Fast players skip phases.
- After every stage boss you pick **1 of 3 stat upgrades**.

**The Dragon** comes in 4 colors, picked at random. Its color sets its attacks and the element of its loot:

| Dragon | Breath | Loot element |
|---|---|---|
| Red Dragon | Fire | Fire |
| White Dragon | Frost | Ice |
| Storm Dragon | Lightning | Lightning |
| Green Dragon | Poison cloud | Poison |

### 7.5 How one stage is built (template)
Each stage is about 8 sections chained together:

1. **Start**: short run-in, a free weapon or Lucky Block
2. **Combat stretch**: groups of mobs on open ground
3. **Traversal**: platforming using the biome's gimmick
4. **Branch**: main path vs side path (key, chest or ability) vs **skip route** (hard movement, saves time)
5. **Arena**: doors lock, wave of mobs (fast kills = faster exit, and a big flask refill).
6. **Traversal 2**: harder version of section 3
7. **Loot area**: key chest, cursed chest or timed door (optional)
8. **Boss arena** → then the road to the next village

Stages 2 and 3 also have a **side arena** next to the main path. In runs with the Dragon, it lands there. The doors don't lock, so you can run past it (7.4).

Each stage has about: 3–4 Lucky Blocks, 2 free loot spots (weapon or ability), 2 keys, 3 locked key chests, 1 cursed chest. That's fewer keys than locked chests, so you pick which chests to open. A Thief's Lockpick gets you one extra.

### 7.6 Routes inside a stage
- **Main path**: always clear where to go (arrows/lighting). Never lost.
- **Side paths**: keys and chests, cost 10–30s detour. Worth it or not? That's the speedrun choice.
- **Skip routes**: need good movement or a specific ability (Grapple Arrow, Blink, Shoulder Charge). Save time.

---

## 8. Loot

### 8.1 Weapon grades (F → C → B → A → S)
Every weapon drops with a grade. It's the **same weapon, upgraded**: more damage, plus powers at higher grades.

| Grade | Color | Damage | Power |
|---|---|---|---|
| **F** | Gray | 80% | Nothing |
| **C** | Green | 100% | Nothing (gets an element with the Wizard bond) |
| **B** | Blue | 125% | 1 element (fire, ice, lightning, poison, or wind) |
| **A** | Purple | 160% | Stronger element + 1 bonus perk (faster attacks, crit chance, lifesteal, etc.) |
| **S** | Gold | 200% | Max-strength element + perk + a **signature move** and its own name |

S-grade example: a fire Greatsword becomes **"Sunbreaker"**, and its 3rd hit sends a wave of fire along the ground. A lightning Storm Hammer becomes **"Skysplitter"**, and throwing it drags a storm behind it.

The grade color shows on the item and in the swap popup, so you can tell in a split second if it's better. The popup also shows the item's class icon and whether it would match your abilities.

### 8.2 Elements

| Element | What it does |
|---|---|
| **Fire** | Burns enemies over time; burning enemies spread fire when they die |
| **Ice** | Slows enemies; enough hits freezes them; hitting a frozen enemy shatters it for big damage |
| **Lightning** | Each hit jumps to 2 nearby enemies |
| **Poison** | Stacks damage over time; more hits = more stacks |
| **Wind** | Big knockback, and **every kill refunds your dash** (the speed element) |

### 8.3 Grade odds

**Free loot by stage.** Odds get better as you go deeper:

| Stage | F | C | B | A | S |
|---|---|---|---|---|---|
| 1. Plains & Forest | 50% | 35% | 10% | 4% | 1% |
| 2. Mountains or Dark Forest | 30% | 38% | 20% | 9% | 3% |
| 3. Enemy Kingdom | 12% | 32% | 33% | 18% | 5% |
| 4. King's Castle | 0% | 15% | 37% | 36% | 12% |

**Riskier sources get better odds.** Stage 1 example:

| Source | Risk | F | C | B | A | S |
|---|---|---|---|---|---|---|
| Free loot | None | 50% | 35% | 10% | 4% | 1% |
| Key chest / Guardian / timed chest | Detour for a key, boss fight, or beating the clock | 35% | 38% | 18% | 7% | 2% |
| Cursed chest | One-hit death until 10 kills | 0% | 20% | 50% | 25% | 5% |

In later stages every source moves up the same way free loot does.

**Dragon** (Stage 2 or 3 only): always **A grade or better**, 75% A / 25% S, with the Dragon's element. These odds don't change by stage.

Exact numbers will get tuned in playtesting.

Drops lean a little toward the classes of the abilities you're carrying (about half of drops match), so building toward a Connection bonus is possible but not guaranteed.

### 8.4 Chest types

| Chest | What you get | Catch |
|---|---|---|
| **Free loot** | A weapon or a Lv1 ability (on a stand, or in an open chest) | None |
| **Lucky Block** | A random **buff or debuff** | It's a gamble (8.5) |
| **Key chest** | Choose 1 of 2 (weapons or Lv1 abilities) | Needs a key (8.7) |
| **Cursed chest** | A high-grade weapon + lots of gold | A curse (8.6) |
| **Timed chest** | A weapon | Behind a timed door (6.3) |

- Opening is **instant**, with no long animation.
- Items pop out and you swap with one button, with a quick compare popup (grade color, damage, class icon, and whether it changes your bond or hybrid).

### 8.5 Lucky Block
You **hit it with your weapon** (no stopping to open it). It pops and shows what you got in big text.

- **55% buff, 45% debuff.**
- Buffs last until the end of the current stage. Debuffs last 45 seconds, so they hurt but never ruin a run.

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
- You can carry up to 3 keys. Leftover keys carry over to the next stage.
- Village shops sometimes sell a key. The Thief hybrid's Lockpick opens 1 chest per stage for free (4.3).

---

## 9. Villages and shops

### 9.1 Villages
There's a village before Stage 1 and between every stage:

| Village | Comes after | Special |
|---|---|---|
| **Home Village** | Start of every run | Pick your starting class, hit a practice dummy, see your unlocks. Instant restart skips it and keeps your class |
| **Crossroads Village** | Stage 1 | **Choose your road**: Mountain road or Forest road |
| **Border Village** | Stage 2 | Last stop before the enemy kingdom |
| **Rebel Camp** | Stage 3 | Hidden camp inside the enemy kingdom, right before the castle |

Every village (except Home Village) has:
- **A shop** (9.2).
- **An inn.** To start the next stage you **sleep** there. Sleeping **restores all your HP** (not the flask, 5.2) and takes you to the start of the next stage.
- The timer keeps running (6.2), so a speedrunner shops fast and goes straight to bed.

### 9.2 The shop
- Sells **3 items** (weapons or Lv1 abilities) using that stage's grade odds, with at least one weapon **B or better**.
- **Ability upgrade**: +1 level to one of your abilities (price depends on the level, 9.3).
- **Sell an ability**: get gold back based on its level (9.3).
- **Flask upgrade** (+1 max charge, up to 4) and an expensive **instant flask refill**.
- Sometimes a **key**.
- **Reroll** the 3 items (gets pricier each time).
- Buying is **walk up + press one button**. No menus. Fast.
- A **wandering merchant** sometimes shows up mid-stage with rare stock. He sells items and ability upgrades, but doesn't buy.
- **Gold** comes from enemies + chests, and resets every run.

### 9.3 Prices (starting numbers, will be tuned)
These are placeholders until we know how much gold a stage gives. The target is roughly **400–600 gold per stage**, so you can't max out everything and have to choose.

**Abilities**

| Level | Cost to reach this level | Total spent | Sells for |
|---|---|---|---|
| Lv1 | 120 (buy it) | 120 | 60 |
| Lv2 | 100 | 220 | 110 |
| Lv3 | 175 | 395 | 200 |
| Lv4 | 275 | 670 | 335 |
| Lv5 | 400 | 1,070 | 535 |

Selling gives back about **half** of what you spent on that ability.

**Weapons (by grade)**

| F | C | B | A | S |
|---|---|---|---|---|
| 40 | 80 | 160 | 320 | 640 |

**Other**

| Item | Price |
|---|---|
| Flask upgrade (+1 charge) | 300 |
| Instant flask refill | 250 |
| Key | 150 |
| Reroll | 50, then +50 each time |

---

### 9.3 Training Yard (tutorial)
A practice area through a gate on the left of the Home Village. One path of **17 stations**: movement (run, jump, double jump, dash, wall jump, ledge grab, slide and crawl, drop-through, dive slam), combat (combo, two weapons, dodging a sparring dummy's swings, healing, abilities and the link, the Rush meter) and speed techniques (dash-jump, slide-jump, dive bounce). Each has a sign with the keys and a flag that turns green when you do it. You can't die, pits put you back at the station, and a board shows what you've finished. The first time you pick a class the game asks if you want to try it. Details: `docs/levels/training-yard.md`.

## 10. Progression

### 10.1 Inside a run
- Weapons you find (swap anytime). Weapon grades go up as you go deeper (8.3).
- Abilities you find or buy start at Lv1, and you level them up at village shops (5.5).
- Your class changes with the abilities you carry: Connection bonus or hybrid (4.3).
- Stat upgrades after each stage boss: pick 1 of 3 (+damage, +HP, +speed, +cooldown, Bloodthirst, etc.).
- Enemies get tougher each stage, so finding higher grades and buying levels matters.

### 10.2 Between runs (light meta)
- All 4 starting classes are unlocked from the start.
- Sometimes enemies drop **blueprints** that unlock a new weapon or ability into the loot pool.
- **No permanent stat boosts**, so runs are always fair to compare for speedrunning.
- A "classes discovered" page fills in as you get each Connection bonus and hybrid. Beating the King with a class unlocks a third starting weapon for it. Cosmetic accessories come from mob drops and stay in your collection forever (4.5, M12).
- Best times are saved on your computer **per starting class** and **per road** (Mountain or Forest).

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
| Interact / swap / buy / sleep | E | B |
| Instant restart | R (hold) | Select (hold) |

All rebindable. Bond passives and Vampire are always on, so they don't add any buttons.

---

## 12. Look and sound
- Pixel art, 2D side view. Each biome has its own color palette so you always know where you are.
- Villages are cozy and calm (warm lights, quiet music) as a break between stages.
- Your character's look is your own choice, not your class (4.5). A trim/glow color shows your current class or hybrid.
- **Game feel** is a priority: hit-stop on big hits, screen shake, enemy flash, punchy sounds.
- Each element has its own look and sound (fire crackle, ice shatter, Storm Hammer thunder, etc.).
- The Dragon gets a warning before it arrives (a shadow passes over, a roar) so it feels like an event.
- Flask fill bar ticks up with a little sound on every kill, so you feel the heal coming.
- Music speeds up / adds layers with Rush level.
- Start with simple placeholder shapes, add real art after the game feels good.

---

## 13. Tech (decided)

- **Engine: Phaser 4.2.1** with **TypeScript** and **Vite**. Runs in any PC browser; you play from a link (GitHub Pages). No install.
- Why: it was the only engine that worked end to end in the cloud setup (install, build, run in a browser, screenshot, read the game state). Builds take about 2 seconds. Godot was the runner-up: a great 2D engine, but its playable builds couldn't be made here and would be 30–300× bigger to download.
- **Art and sound are generated by code** (Python scripts), so Claude can make and check everything.
- The exact tech details, architecture and folder layout are in `docs/spec/00-README.md`.

### 13.1 How we work
- **This chat (design):** decides the game and writes the instructions: this plan, the exact spec (`docs/spec/`), and step-by-step build plans (`docs/plans/`).
- **Build chat:** reads `CLAUDE.md` automatically, follows the build plans in order, and builds code, UI, art and sound. It never changes the design; questions go to `docs/SPEC-GAPS.md` and come back here.

---

## 14. Build order (milestones)

Each milestone ends with something you can play.

| M | Goal | You can play… |
|---|---|---|
| M0 | Project setup | An empty screen with a square you can move |
| M1 | **Movement feel** | A grey test level with all moves from section 3 |
| M2 | **Combat + Stage 1 enemies** | Greatsword + War Maul, all 5 Stage 1 enemies (Wolf, Bandit, Bandit Archer, Wild Boar, Bandit Brute), HP, flask, Rush, hit-stop, death and restart |
| ART1 | **Style board (Stage 1)** | Real art for the 4 player outfits, all Stage 1 enemies, Plains tiles and background, on one image for you to approve. Can run alongside M2 |
| ART2 | **Stage 1 enemies finished** | Great Boar boss art, enemy projectiles, hit/stun effects, sounds for every Stage 1 enemy and combat (art chat). Style board v1 approved |
| M3 | **Stage 1 + Great Boar** | The full Plains & Forest stage (8 sections, arena with waves, timed door, hints) and the Great Boar boss fight, with the timer and split. Loot shows as grey markers until M5 |
| V1 | **Stage 1 with real art and sound** | The builder swaps the grey boxes for the real sprites, tiles, background, effects and sounds (after M3 + ART2) |
| ART3 | **Villages** | Art for the Home Village and Crossroads Village: backgrounds, inn, shop objects, class statues, NPCs, training dummy (art chat). Can run alongside M3–M5 |
| ART4 | **Stage 1 finished + loot art** | Every player move in all 4 outfits, Greatsword and War Maul attacks, doors and decorations, chests, keys, coins, all HUD icons and fonts, movement and loot effects and sounds (art chat) |
| ART5 | **Class weapons + abilities art** | The 6 new starting weapons, their projectiles, ability poses, effects and sounds for M4 (art chat) |
| M3.1 | **Gentler Stage 1 start** | The first fights spread out into small groups with breathing room (after playtesting) |
| M4 | **Classes, abilities, weapons (basics)** | Pick a class and starting weapon; 2 abilities per class + Vampire; all 4 Connection bonuses and 6 hybrids; weapon match; the 6 starting weapons that were missing (Katana, Iron Fists, Bow, Crossbow, Storm Hammer, Staff); the **Training Yard** tutorial (17 stations) with an armory and dummies |
| M5 | **Loot** | Grades F–S, elements, free loot, Lucky Blocks, keys + key chests, cursed chest, timed chest, coins, boss weapon drop, merchant items |
| M6 | ~~Classes + abilities~~ | Moved into M4 |
| M7 | **Villages + Stage 2** | Home Village, Crossroads Village, inn and sleeping, shop with prices, buying and selling abilities, upgrading them Lv1–5, both Stage 2 roads with their mobs and Guardians, stat upgrades, run summary, saved best times |
| M8 | **Art + sound pass** | Stages 1–2 and the villages look and sound real, class outfits |
| M9 | **Stages 3–4 + Dragon** | Border Village, Enemy Kingdom, Rebel Camp, King's Castle, Black Knight, Enemy King, the Dragon event, all 17 abilities, all 19 weapons, Rush meter, timed doors |
| M10 | **Speedrun extras + polish** | Seeds, practice mode, ghosts, balance |
| M11 | **Layout variety** | Each section of each stage has several hand-made versions; every run picks a different mix (14.1) |
| M12 | **Character customization** | Character creator (race, looks, clothing colors), accessory drops from mobs and bosses, collection book (4.5) |

**First thing to make fun: M1.** If running and jumping around the empty test level isn't fun, nothing else will be.

---

### 14.1 Later: layouts that change every run (idea, not built yet)

**Your idea:** like Dead Cells, the map layout should be a little different every run.

**How it would work (Dead Cells does it the same way):**
- Each stage keeps its **8 sections in the same order** (start, combat stretch, traversal, branch, arena, traversal 2, loot area, boss). The biome, enemies, boss and story stay the same.
- But each section has **3–4 hand-made versions** ("room variants"). Every run, the game picks one version per section using the run's seed. 8 sections × 3–4 versions = thousands of different stages, and every piece is still hand-designed, so it's always fair and fun.
- **Connectors:** every version of a section starts and ends at the same height, so any version fits next to any other.
- Chests, keys, Lucky Blocks and enemies have **slots** in each version. The counts per stage stay the same (4 Lucky Blocks, 2 keys, 40 regular enemies…), only where they are changes.
- The arena and boss arena stay fixed, so the fights stay learnable.

**Speedrunning still works:**
- **Same seed = same layout.** Races on a typed seed are fair, and practice mode can use a fixed seed.
- Players learn each section's versions rather than one fixed map, the way Dead Cells speedrunners do.
- Personal bests stay per class and road. An optional "fixed layout" setting could keep the classic map for players who want it (to decide later).

**Why this is cheap to add later:** the level builder already makes each section from its own file (`s1.txt` … `s8.txt` in M3). Adding variants means drawing more files per section and letting the seed pick. The checks we already have (enemy counts, jump limits) would run on every possible combination.

**When:** after the full game works (M11). Until then every run uses version 1 of each section.

## 15. What's left to discuss

### 15.1 Still open from before building
1. ~~Engine~~: decided, Phaser 4.2.1 (section 13).
2. ~~Art~~: decided, Claude draws it in code; you approve a style board first.
3. **Dying:** restart the whole run, or just the current stage? (A2) The spec builds "whole run".
4. **Layouts:** same every run (speedrun-friendly) or random? (A4) The spec builds "same every run".

### 15.2 Topics we haven't talked about yet

| Topic | What we'd decide | My suggestion |
|---|---|---|
| **Why the rush?** | The story reason for the timer | The King's army is about to march on your home village. You have to reach him first |
| **Names** | The Enemy King's name, the kingdom's name, the game's real title | Pick these once the story is set |
| **Harder modes after you win** | Replay value | "Heat" levels 1–5: faster enemies, fewer flask charges, tighter timed doors. Each level gets its own best times |
| **Stat upgrades** | The pick-1-of-3 pool after each boss | About 12 options |
| **Gold drops** | How much gold a stage gives, to set the prices in 9.3 | Aim for 400–600 per stage, tune in playtesting |
| **Tutorial** | How new players learn the moves | **Decided:** a Training Yard next to the Home Village with 17 practice stations on dummies (9.3), and Stage 1 still teaches as you play |
| **Accessibility** | Options for players who struggle | Assist mode (slower game speed, extra flask charge). Assist runs don't count for best times |

### 15.3 Quick checks on my guesses
1. **Road choice:** you pick the Mountain or Forest road at the Crossroads Village (what I wrote). Or should it be random?
2. **Dragon:** 30% of runs, shows up in Stage 2 or 3 in a side arena, and it's optional. Or should it always be in the same place (like the mountains), or have a 30% chance in every stage?
3. **Ability levels go up to 5** (you said "level 1 or 5"). Right, or keep the max at 3?
4. **Abilities only level up by paying at shops.** Finding the same ability again no longer levels it up. Right?
5. **Sleeping restores HP but not the flask.** Okay?
6. **Vampire** is neutral, so carrying it means no bond or hybrid for that slot. Okay?
7. Grades are **F, C, B, A, S** (no D). Want a D?
8. **Lucky Block** at 55% buff / 45% debuff. Okay, or 50/50?
9. Keep **"RUSHBLADE"** as the working title?
