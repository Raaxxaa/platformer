# Level Design: Training Yard (tutorial)

A calm practice area next to the Home Village where new players learn **every move and technique** on dummies before Stage 1. Added after playtesting: friends found the game hard to start. The rules (no death, checkpoints, entry and exit) are in `docs/spec/06-run-levels-save.md` §12.4; the dummies are `docs/spec/04-enemies-bosses.md` §2.10–2.12.

The builder turns this into `levels-src/training_yard/` like the Plains chunks.

**Thumbnails** are rough sketches. Legend: `P` start, `#` ground, `=` one-way platform, `|` wall, `D` training dummy, `X` sparring dummy, `t` straw target, `S` item stand, `C` class statue, `!` station sign, `✓` station check flag, `E` exit.

## How it works (player view)

- The yard is one long path, left to right, split into **stations**. Each station has a **sign** that says what to do and which keys to press (07 hint style, e.g. `Space in the air — double jump`), and a **check flag** that turns green with a chime when you do it.
- Nothing can kill you. Falling into a pit puts you back at the station's start. Your flask is refilled at every station.
- You can walk past a station you don't care about. A **checklist board** at the end shows which stations you finished.
- **Leave** at any time through the exit at either end (or the pause menu). Your loadout goes back to the kit you picked.

## Part A — Movement (stations 1–8)

```
 C C C C   !1        !2   ___      !3                !4  |  |   !5        !6 ________      !7 ===     !8  ___
 P         _  _     |      |       ____   gap 8  ____    |  |_____      |__________|___     ===        |   |
 ######## ## ## ###  ######   ###  ####          ####  ##|  |#####  ### ###  tunnel  ####  =====  ###  D  ###
```

| # | Station | Layout | Done when |
|---|---|---|---|
| — | **Class statues** | The 4 statues at the start (pick your kit here if you have none) | — |
| 1 | **Run and jump** | Two 2-tile steps, then a 3-tile gap over a shallow pit | You reach the far side |
| 2 | **Double jump** | A ledge 6 tiles up | You stand on the ledge |
| 3 | **Dash** | An 8-tile gap (too far to jump) with a safe pit under it | You cross it using an air dash |
| 4 | **Wall jump** | A 4-wide, 10-tall shaft with a rest ledge halfway | You exit at the top |
| 5 | **Ledge grab** | Right at the shaft's top: a ledge just out of jump reach. Sign: "Hold toward a ledge to grab it" | You climb a ledge |
| 6 | **Slide and crawl** | A 1-tile-high tunnel 7 long (slide), then a 12-long crawlspace | You come out the other end |
| 7 | **Drop through** | A stack of 4 one-way platforms down into a pit room | You drop through one |
| 8 | **Dive slam** | A platform 6 tiles above a training dummy | Your dive slam hits the dummy |

## Part B — Combat (stations 9–14)

```
  !9        !10 S       !11          !12        !13 S          !14  t   t   t   t   t   t
  D         D           X            D          D               ________________________ (40 tiles)
 ######   ##########  #######    #########   ##########      ############################
```

| # | Station | Layout | Done when |
|---|---|---|---|
| 9 | **Combo** | A training dummy | You land every step of your weapon's combo in one chain |
| 10 | **Two weapons** | A stand with your class's other starting weapon, then a dummy | You hit the dummy with weapon 2 |
| 11 | **Dodge** | A sparring dummy (swings every 2 s with an orange flash) | You dash through 3 swings without being hit. Getting hit resets the count |
| 12 | **Heal** | Entering sets your HP to 40 and gives 1 flask charge | You drink the flask |
| 13 | **Abilities** | A dummy, then a stand with your class's second ability (M4 list), then another dummy | You use ability 1, pick up ability 2 (the HUD shows the Connection bonus), then use both within 3 s for a **link** |
| 14 | **Rush** | A 40-tile flat lane with 6 straw targets | You reach **Rush level 1**. Sign: "Keep moving and hitting — don't stop!" |

## Part C — Speed techniques (stations 15–17)

```
  !15                    !16    ____            !17  t     t     t          ✓✓✓ board   E
  ____   gap 8 (dash-jump) ____ |slide| __ gap 6 __ ____      pit       _____   ________________
 #####                    #####  ######          ####  (posts over a pit)  ####  ################
```

| # | Station | Layout | Done when |
|---|---|---|---|
| 15 | **Dash-jump** | An 8-tile gap with a pit under it. Sign: "Dash, then jump right away to keep the speed" | You cross with a dash-jump (jump during a dash) |
| 16 | **Slide-jump** | A slide tunnel that ends at a 6-tile gap. Sign: "Jump out of a slide to keep its speed" | You cross with a slide-jump |
| 17 | **Dive bounce** | 3 straw targets on posts over a 20-tile pit | You cross by dive-bouncing off the targets without touching the pit |

## The end

- **Checklist board:** lists all 17 stations with a check for each one done.
- **Armory (practice):** endless stands with every M4 ability and weapon (the M4 plan's armory), plus a training dummy with the DPS readout. Everything here is practice only.
- **Exit** back to where you came from.

## Later

- **M5 (loot):** add a loot corner after station 17: a Lucky Block, a key and a key chest, with signs.
- **M7 (villages):** the yard is entered from the Home Village's `training_gate` (06 §12.3), and the first time you pick a class the game asks "Try the Training Yard first?".

## What to show the user

Screenshots of each part. Ask: is every sign clear? Which station was confusing? Is anything missing your friends struggled with?
