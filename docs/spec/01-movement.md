# 01 — Movement, Collision, Special Surfaces, Camera

This file defines how the player moves, how the player collides with the level, the special surfaces and movement objects, and the camera. Read `00-README.md` first (units, 120 ticks/s, architecture).

**This file owns:** `InputState`; player physics and the collision algorithm; run, jump, double jump, dash, wall slide, wall jump, slide, crawl, dive slam, ledge grab, drop-through; coyote time and jump buffer; momentum rules; player hurtbox sizes per state; one-way platforms, swamp water, ice, spikes, collapsing platforms, minecart, grapple points, stuck-javelin platforms; camera behavior.

**Not here (only referenced):** damage formula, i-frame lengths, hurt state, knockback values, hit-stop lengths, dive slam damage and hitbox, weapon attack data: `02-combat.md`. Ability numbers (Blade Dash, Blink, Grapple Arrow range/speed, etc.): `03-classes-abilities.md`. Enemy behavior: `04-enemies-bosses.md`. Lucky Block/curse values: `05-loot-economy.md`. Tiled encoding of tiles and objects, doors, arenas: `06-run-levels-save.md`. Key bindings and the screen-shake setting: `07-ui-hud-controls.md`. Sprites and animations: `08-art-audio.md`.

All code for this file lives in `src/core/` (pure, no Phaser): `input.ts` (types only), `player/movement.ts`, `physics/collide.ts`, `level/surfaces.ts`, `camera.ts`. The Phaser layer only reads the results.

---

## 1. Input

### 1.1 InputState

The Phaser layer builds one `InputState` per simulation tick and passes it to the core.

```ts
interface ButtonState {
  held: boolean;      // down at the moment the tick is built
  pressed: boolean;   // went down at least once since the previous tick (latched)
  released: boolean;  // went up at least once since the previous tick (latched)
}

interface InputState {
  moveX: -1 | 0 | 1;   // -1 left, +1 right
  moveY: -1 | 0 | 1;   // -1 up, +1 down
  jump: ButtonState;
  dash: ButtonState;
  attack1: ButtonState;   // weapon slot 1
  attack2: ButtonState;   // weapon slot 2
  ability1: ButtonState;
  ability2: ButtonState;
  heal: ButtonState;
  interact: ButtonState;
  restart: ButtonState;   // hold length is measured by 06
  pause: ButtonState;     // handled by the Phaser layer; the core ignores it
}
```

### 1.2 Building the snapshot

1. **Latching.** A press that starts and ends between two ticks must still count: `pressed = true` and `held = false` on the next tick. `pressed` is true for exactly one tick per press.
2. **Keyboard + gamepad** are merged: a button is `held` if either device holds it.
3. **Opposite directions (left + right, or up + down):** the most recently pressed one wins. If it is released while the other is still held, the other one applies again.
4. **Gamepad stick:** `moveX = sign(x)` if `|x| >= 0.30`, else 0. `moveY = sign(y)` if `|y| >= 0.60`, else 0 (the higher threshold stops accidental slides and dive slams while running). The D-pad gives full ±1. Stick and D-pad merge with the rule in step 3.
5. **No analog walking.** Run speed is always the full target speed for `moveX = ±1`.
6. Menus use their own input reading (07); nothing here applies inside menus.

---

## 2. Player body and collision

### 2.1 Body

- Position `(x, y)` is in **whole pixels**: `x` is the horizontal center, `y` is the bottom edge (feet). The box spans `[x - w/2, x + w/2)` horizontally and `[y - h, y)` vertically.
- Sub-pixel motion is stored in remainders `remX`, `remY` (floats, always in `[-0.5, 0.5]` after a move).
- Velocity `vx`, `vy` in px/s (floats). +y is down.
- The **collision box equals the hurtbox** in every state except the minecart.

### 2.2 Box sizes per state

| State(s) | Box w × h (px) | Notes |
|---|---|---|
| Ground, Air, Dash, WallSlide, LedgeClimb, DiveWindup, DiveFall, DiveLand, Hurt, Dead | **12 × 28** | README anchor |
| Forced (§12.3) | same as the state it started from | Regrows at the end if it fits |
| Slide, Crawl | **12 × 14** | Fits through 16 px (1-tile) gaps with 2 px to spare |
| Minecart | **12 × 20** hurtbox, feet 8 px above the cart's bottom | Collision uses the cart's box (§13.6) |

**Growing back to 12 × 28** (leaving Slide/Crawl, leaving the cart) only happens if the 12 × 28 box at the same `(x, y)` is free of solids. If it is not free, the player keeps the low box (on the ground this means Crawl, §9.3; in the air the player stays in Air with the 12 × 14 box and retries every tick).

### 2.3 What blocks the player

| Thing | Blocks horizontally | Blocks falling | Blocks rising |
|---|---|---|---|
| Solid tile, ice tile | yes | yes | yes |
| One-way tile or one-way body | no | only from above (§2.6) | no |
| Solid body (door, cracked wall, collapsing platform, etc.) | yes | yes | yes |
| Water, spike tiles | no (non-solid zones) | no | no |
| Enemies, bosses | **no** (no body collision) | no | no |
| Map edges (all four) | yes | yes | yes |

- **No body collision with enemies:** the player and enemies pass through each other. Hook: if an enemy entry in 04 sets `blocksPlayer: true`, its body box blocks the player horizontally like a solid body, except while the player is in Dash, Slide or Forced state. The default is `false`.
- **No slopes** in this game. All solid geometry is axis-aligned.
- **No moving solid platforms** except collapsing platforms (which only disappear and reappear) and the minecart (which carries the player).
- **No fall damage**, from any height.
- **No bottomless pits.** The bottom map edge is solid. Level design (06) puts a floor (often with spikes) under every gap.

### 2.4 The move step (axis-separated, pixel by pixel)

Each tick, after velocities are final (§3 step 7):

```
dx = (vxStart + vxEnd) / 2 * TICK      // trapezoid rule: exact for constant acceleration
dy = (vyStart + vyEnd) / 2 * TICK
moveX(dx) then moveY(dy)
```

`vxStart`/`vyStart` are the velocities after every instant change this tick (jump, cut, dash start, impulse). `vxEnd`/`vyEnd` are after acceleration, gravity and caps.

```
moveX(amount):
  remX += amount
  n = roundHalfAwayFromZero(remX); remX -= n
  s = sign(n)
  repeat |n| times:
    if box at (x + s, y) is free (horizontal rules): x += s
    else if stepUp(s) succeeded: (x and y already changed)          // §2.7
    else: onWallHit(s); remX = 0; stop

moveY(amount):
  remY += amount
  n = roundHalfAwayFromZero(remY); remY -= n
  s = sign(n)
  repeat |n| times:
    if s > 0 and (any solid pixel in row `y` within the box's x-span, or oneWayTopAt(y) and not dropping): onLand(); remY = 0; stop
    if s < 0 and solid above at (top - 1):
       if ceilingNudge() succeeded: continue the step              // §2.7
       else: vy = 0; remY = 0; jumpCuttable = false; stop
    y += s
```

- The fastest the player can move is 600 px/s = 5 px per tick, so pixel stepping never tunnels and stays cheap.
- `roundHalfAwayFromZero` (not `Math.round`) so left and right are symmetric.
- Absolute caps: `|vx| <= 600`, `vy` between `-600` and `+600`.

### 2.5 Grounded check

After moving, the player is **grounded** if `vy >= 0` and either a solid occupies any pixel in the row `y` (directly under the feet) across the box width, or `oneWayTopAt(y)` is true. The **support** is the set of tiles/bodies that make this true.

### 2.6 One-way rule

A one-way tile/body blocks a downward 1-px step only if its **top edge equals the player's `y`** before the step (the feet are exactly on top) and the box overlaps it horizontally. It never blocks sideways or upward movement. A player rising through a one-way platform overlaps it freely and lands on it once falling with the feet at its top.

### 2.7 Corner forgiveness ("never lose a jump by a pixel")

1. **Ceiling nudge.** When an upward step is blocked, try shifting the box sideways by `d = 1..4` px. For each `d`, test the side of `moveX` first (if `moveX = 0`, test right first). A shift works if the box is free both at `(x ± d, y)` and `(x ± d, y - 1)`. The first working shift is applied and rising continues. If none works: bonk (`vy = 0`).
2. **Step-up.** When a horizontal step is blocked, try lifting the box by `d = 1..4` px: it works if the box is free at `(x, y - d)` and `(x + s, y - d)`. Then `y -= d`, `x += s`. This lifts the player onto a ledge they clip with their feet (common at the end of a dash). Not used in DiveFall or LedgeClimb.
3. **One-way apex assist.** On the tick `vy` goes from `< 0` to `>= 0` (the apex): if the feet are 1–6 px below the top of a one-way platform that overlaps the box horizontally, and the box placed with feet on that top is free, snap the feet onto it and land.
4. **Ledge grab** covers ledges 5–24 px above the feet (§10).

### 2.8 Push-out (safety)

At the end of every tick, if the box overlaps a solid (a door closed on the player, a platform respawned, a box grew), push out: for `d = 1..32`, try up `d`, then left `d`, then right `d`, then down `d`; take the first free position. If nothing is free within 32 px, do nothing and log `// SPEC-GAP` warning in debug builds. Collapsing platforms never respawn while overlapping the player (§13.5), so this is rare.

---

## 3. Per-tick order of operations

The player has its own tick counter `pt`, which only advances when the player simulates (it stops during the player's hit-stop, 02). Windows (coyote, buffers, cooldown) are measured in `pt`.

1. **Hit-stop check.** If the player is in hit-stop:
   - If `jump.pressed` or `dash.pressed` is true and that move would be accepted this tick (the §6.4 jump checks or the §7.1 dash checks on the current state, using `pt + 1`, the value step 2 gives it), set the player's remaining hit-stop to 0 and continue with step 2 on this tick; the move happens this tick (02 §4.1).
   - Otherwise record `jump.pressed` / `dash.pressed` into the buffers (stamped with the current, frozen `pt`) and skip the rest.
   The run timer counts either way (README).
2. **Advance:** `pt += 1`; `stateTicks += 1`. End any timed state whose duration has run out (Dash ends on the tick `stateTicks` would become 19, etc.), applying its end rule.
3. **Record presses:** if `jump.pressed` → `jumpPressPt = pt`, `jumpPressFresh = true`. If `dash.pressed` → `dashPressPt = pt`.
4. **Read modifiers** (`MoveModifiers`, §12.1) set by other systems this tick.
5. **Actions, in this fixed order:**
   a. Dash / slide start (§7, §9) if the dash buffer is active.
   b. Jump (§6.4 priority) if the jump buffer is active. A jump started here can use a dash started in 5a on the same tick (same-tick dash-jump).
   c. Dive slam start (§11) — skipped if a jump started this tick.
   d. Jump cut (§6.3).
   Any jump or dash executed while an attack is in progress first calls combat's `cancelAttack()` (02) on the same tick.
6. **Horizontal velocity** by state (§5).
7. **Vertical velocity** by state (gravity, caps, §5.4).
8. **Move:** `moveX`, then `moveY` (§2.4).
9. **After move, in this order:** grounded check and landing/leaving-ground (§5.5); wall contact (§8.1); ledge grab check (§10); state transitions (wall slide, slide→crawl, dive land, etc.); surface and zone detection (water, ice); spike check (§13.4); collapsing platform triggers; minecart boarding; push-out (§2.8).
10. **Facing and box size** update; emit movement events (§15).

**Timed states:** on the tick a state starts (step 5), `stateTicks = 1`. A state lasting N ticks ends at step 2 of the tick where `stateTicks` would become N + 1. So the dash moves on exactly 18 ticks.

---

## 4. Tuning constants

All of these live in `src/core/tuning.ts` as `MOVE`. Ticks = `Math.round(seconds * 120)`.

| Name | Value | Ticks | Meaning |
|---|---|---|---|
| `RUN_MAX` | 170 px/s | | Target run speed (× speed multiplier) |
| `GROUND_ACCEL` | 1800 px/s² | | 0 → 170 in 12 ticks |
| `GROUND_DECEL` | 2400 px/s² | | No input on ground; 170 → 0 in 9 ticks |
| `GROUND_TURN` | 2400 px/s² | | Input opposite to motion, on ground |
| `AIR_ACCEL` | 1400 px/s² | | |
| `AIR_DECEL` | 900 px/s² | | No input in air |
| `AIR_TURN` | 1400 px/s² | | Input opposite to motion, in air |
| `OVERSPEED_DECAY_GROUND` | 1600 px/s² | | Speed above max, holding forward, on ground |
| `OVERSPEED_DECAY_AIR` | 600 px/s² | | Same, in air |
| `GRAVITY` | 1500 px/s² | | |
| `MAX_FALL` | 400 px/s | | |
| `MAX_FALL_DOWN_HELD` | 520 px/s | | Holding down in Air |
| `FALL_CAP_DECEL` | 2400 px/s² | | How fast vy drops to a lower cap |
| `JUMP_V` | −410 px/s | | Full jump peak 56 px |
| `JUMP_CUT` | ×0.45 | | Release while rising |
| `DOUBLE_JUMP_V` | −346 px/s | | Peak 40 px |
| `COYOTE` | 0.10 s | 12 | |
| `JUMP_BUFFER` | 0.10 s | 12 | |
| `DASH_SPEED` | 400 px/s | | |
| `DASH_TIME` | 0.15 s | 18 | 60 px |
| `DASH_COOLDOWN` | 0.35 s | 42 | Starts when the dash/slide ends; × `dashCooldownMult`, rounded half up (§7.3) |
| `DASH_BUFFER` | 0.10 s | 12 | |
| `SLIDE_SPEED` | 330 px/s | | |
| `SLIDE_TIME` | 0.30 s | 36 | 99 px |
| `SLIDE_IFRAMES` | 0.15 s | 18 | First part of the slide |
| `CRAWL_MAX` | 80 px/s | | |
| `WALL_SLIDE_MAX` | 90 px/s | | 400 when holding down |
| `WALL_JUMP_VX` | 220 px/s | | Away from the wall |
| `WALL_JUMP_VY` | −400 px/s | | Peak 53 px (playtest: was −380) |
| `WALL_JUMP_LOCK` | 0.10 s | 12 | No steering (playtest: was 0.12 s) |
| `WALL_JUMP_RANGE` | 4 px | | Max gap to a wall for a wall jump (playtest: was 3) |
| `WALL_COYOTE` | 0.10 s | 12 | |
| `LEDGE_WINDOW` | 5–24 px | | Ledge top this far above the feet |
| `LEDGE_CLIMB_UP` | 0.10 s | 12 | Phase 1 |
| `LEDGE_CLIMB_OVER` | 0.05 s | 6 | Phase 2 |
| `DIVE_WINDUP` | 0.05 s | 6 | Hover |
| `DIVE_SPEED` | 600 px/s | | Straight down |
| `DIVE_LAND_LAG` | 0.10 s | 12 | Cancellable |
| `DIVE_BOUNCE_V` | −360 px/s | | Peak 43 px |
| `SPEED_MULT_MIN/MAX` | 0.5 / 1.8 | | Clamp of the speed multiplier |

---

## 5. States, running and falling

### 5.1 Movement states

| State | Entered by | Left by |
|---|---|---|
| `ground` | Landing; end of slide/dash/climb on ground | Jump, dash, slide, walking off, knockback |
| `air` | Leaving ground; jumps; end of airborne dash; bounce | Landing, wall slide, ledge grab, dash, dive |
| `dash` | §7 | Timer, wall hit, jump, dive, knockback |
| `slide` | §9 | Timer, wall hit, jump, attack or cast (§9.2), leaving ground, knockback |
| `crawl` | Slide ends with no headroom | Room to stand; dash (new slide); falling off |
| `wallSlide` | §8.2 | §8.2 |
| `ledgeClimb` | §10 | Timer, jump, dash, knockback |
| `diveWindup` / `diveFall` / `diveLand` | §11 | §11 |
| `hurt` | Knockback from 02 | Hurt-stun ends (length from 02) |
| `forced` | Ability/weapon `ForcedMove` (§12.3) | Its own end rules |
| `minecart` | §13.6 | §13.6 |
| `dead` | 0 HP (02) | Restart (06). Movement in §5.4 |

### 5.2 Effective max speed

```
speedMult  = clamp(1 + sum of all % move-speed modifiers, 0.5, 1.8)
runMaxEff  = RUN_MAX * speedMult * surfaceMult * actionMoveMult * statusMult
```

- `speedMult` sources (values defined elsewhere): Rush adds **+0.05 / +0.10 / +0.15** at Rush level 1 / 2 / 3 (02 §8.3), Thief Silent Steps (03), Swift / Heavy, the Fleet perk and the Quickstep upgrade (05). They **add** (e.g. +20% and +25% → ×1.45).
- `surfaceMult`: 0.5 in swamp water (§13.2), else 1.
- `actionMoveMult`: applies **only while grounded** (`ground`, `crawl`); in every other state (`air`, `minecart`, etc.) the formula uses 1, so attacks, drinks and casts never cap air speed or bleed momentum in the air (02 §9.3, §7.2; 03 §7.6). Value (`MoveModifiers.actionMoveMult`, set by combat and abilities): the smallest that applies of
  - 02 §9.3's weight cap while a weapon step (startup, active or recovery) or a charge runs: light **0.60**, medium **0.40**, heavy **0.25**;
  - **0.40** while drinking (02 §7.2);
  - **0.50** while the shield is up (02 §12);
  - the cast's ground move cap while a cast runs (03 §7.6, `groundMoveCap`);
  - **0.70** during the Giant Axe spin (its move speed, 02 §10.5; it replaces the heavy cap).
  It is **1** during the Hand Cannon recovery (02 §10.5) and when nothing applies. The Spear lunge and Katana dash-slash are `ForcedMove`s (§12.3), so this formula does not run during them.
- `statusMult`: **0.70** while the player is Chilled (02 §5.4), else 1.
- `speedMult` affects **only** the run target. It does not change dash, slide, jump, wall jump or dive numbers, so level design distances stay fixed.

### 5.3 Horizontal rules (states `ground`, `air`, `crawl`)

Pick the rates by surface: normal ground, ice (§13.3), or air. Let `dir = moveX`, `max = runMaxEff` (in `crawl`: the same product as §5.2 with `CRAWL_MAX` in place of `RUN_MAX`). `approach(v, target, rate)` moves `v` toward `target` by at most `rate * TICK` without passing it.

```
if steering locked (wall jump, impulse lock): vx unchanged
else if rooted:            vx = 0
else if dir == 0:          vx = approach(vx, 0, DECEL)
else if sign(vx) == -dir:  vx = approach(vx, dir * max, TURN)
else if |vx| > max:        vx = approach(vx, dir * max, OVERSPEED_DECAY)   // never drops below max this way
else:                      vx = approach(vx, dir * max, ACCEL)
```

**Momentum:** speed above `max` only comes from dash-jumps, slide-jumps, wall jumps, bounces, impulses, grapple launches and the minecart. Holding forward keeps it longest (decays at 600 px/s² in air, 1600 on ground). Letting go uses the normal decel. A buffered jump on the landing tick keeps all speed, because the jump happens (step 5) before ground friction would apply (step 6).

### 5.4 Vertical rules

- `ground`: `vy = 0`.
- `air`, `hurt`: `vyEnd = vy + GRAVITY * TICK`, capped at `cap`. `cap = MAX_FALL`, or `MAX_FALL_DOWN_HELD` if `moveY = +1`, or `maxFallOverride` from modifiers if set (e.g. Eagle Eye aiming, 03). If `vy` is already above `cap`, instead `vyEnd = max(cap, vy - FALL_CAP_DECEL * TICK)`.
- `air`: gravity is multiplied by `MoveModifiers.gravityMult` (default 1). Only casts set it (03 §7.6 "Gravity ×k", and 0 for "hover"); weapon attacks never change gravity (02 §9.6).
- `dead` (06 §6.1 keeps the world simulating for 1.0 s after death): input is ignored; `vx` uses the no-input decel for its surface (ground, ice or air); `vy = 0` while grounded, otherwise gravity with cap `MAX_FALL` (no down-held, water or override caps); box 12 × 28 if it fits, else the low box (§2.2). Collision, the grounded check and push-out run as usual. No spike checks, collapsing-platform triggers, ledge grab, wall slide, minecart boarding or events except `land`. A player who dies in the minecart leaves it with the cart's velocity; the empty cart rolls on (§13.6).
- Other states set `vy` themselves (below).

### 5.5 Landing and leaving the ground

- **Landing** (air-type state → grounded): `vy = 0`; `airDashAvailable = true`; `doubleJumpAvailable = true`; `jumpCuttable = false`. Emit `land` with the impact speed. No damage, no landing lag (except dive slam).
- Every tick that ends grounded sets `lastGroundPt = pt`.
- **Leaving the ground without a jump** (walking off, dash/slide off, platform collapsing under you): `coyoteValid = true`. A jump, drop-through, impulse, knockback, bounce or launch sets `coyoteValid = false`.

---

## 6. Jumping

### 6.1 Ground jump

`vy = JUMP_V` (−410), or −340 when the feet are in swamp water (§13.2). `vx` unchanged (this is what carries dash/slide speed). State → `air`, `jumpCuttable = true`, `coyoteValid = false`. Peak: **56 px** (3.5 tiles), 0.273 s to apex.

### 6.2 Double jump

Only in the air. `vy = DOUBLE_JUMP_V` (−346), `vx` unchanged. `doubleJumpAvailable = false`, `jumpCuttable = true`. Peak 40 px above where it was used. Disabled when `MoveModifiers.canDoubleJump = false` (e.g. the Heavy Feet curse, 05).

### 6.3 Jump cut (variable height)

On any tick in `air` where `jumpCuttable` is true, `vy < 0`, `jump.held` is false, and this is not the tick the jump started: `vy *= 0.45` and `jumpCuttable = false`. When `vy` reaches `>= 0`, `jumpCuttable = false`. Only ground jumps, double jumps, wall jumps and minecart jumps are cuttable; bounces, spike pops, impulses and launches are not.

Results: tap (held for 1 tick) = 14 px; tap double jump = 10 px; full hold = 56 px.

### 6.4 Which jump happens

The jump buffer is **active** when `pt - jumpPressPt < 12` and that press hasn't been used. Each tick it is active, try in order; the first that applies is executed and the press is used up:

1. **Drop-through** (§13.1): only if `jumpPressFresh` (pressed this tick, not from the buffer), `moveY = +1`, grounded, all support is one-way, and the state is **not `slide`** (a jump during a slide is always a slide-jump, even holding down; design decision, SPEC-GAP 2).
2. **Ground jump:** grounded, or `coyoteValid` and `pt - lastGroundPt <= 12`. Also from `dash` (on ground or within coyote), `slide` (needs room to stand, §9.2), `diveLand`, `ledgeClimb` (§10.3). Not from `crawl`.
3. **Wall jump** (§8.3): airborne and a wall in wall-jump range (gap 0–4 px, §8.1) on either side, or `pt - lastWallPt <= 12`.
4. **Double jump:** airborne and `doubleJumpAvailable`.
5. Otherwise keep the press in the buffer (it can still fire on a later tick within the window, e.g. on landing or reaching a wall).

`jumpPressFresh` is cleared at the end of every tick. Jumps are refused while `rooted`, while `canJump = false`, and in `hurt` (unless 02 allows cancelling hurt-stun).

A jump from `dash` keeps the dash's `vx` (dash-jump). From `slide` it keeps the slide's `vx` (slide-jump). In both cases the dash/slide ends that tick (i-frames end; dash cooldown starts).

---

## 7. Dash

### 7.1 Starting a dash

The dash buffer is active when `pt - dashPressPt < 12` and that press hasn't been used. A dash starts when the buffer is active and all of these hold:

- `pt >= dashReadyPt` (cooldown over) and `canDash` is true and not rooted;
- grounded → **ground dash** (or **slide** if `moveY = +1`, §9); or airborne with `airDashAvailable` → **air dash** (sets `airDashAvailable = false`);
- current state is one of: `ground`, `air`, `wallSlide`, `crawl` (→ slide), `ledgeClimb` (§10.3), `diveWindup`/`diveFall` (cancels the dive), `diveLand`, `minecart` (§13.6), or any of these with an attack in progress (cancels it).

**Direction:** `moveX` if not 0, else facing. From `wallSlide` it is always away from the wall.

### 7.2 During the dash (18 ticks)

- `vx = dir * max(400, preDashSpeed)`, where `preDashSpeed = |vx|` if the player was already moving in `dir`, else 0. A dash never slows you down.
- `vy = 0`, no gravity, input steering ignored.
- **I-frames on all 18 ticks** (`dashIframes = true`): enemy attacks and projectiles do not hit (02 applies this). **Spikes and other level hazards still hit** (§13.4).
- A ground dash that runs off a ledge continues straight (gravity still off) and does **not** use the air dash. Coyote time starts when the ground is left.
- Dash and slide share one cooldown and one buffer.

### 7.3 Ending the dash

- **Timer (natural end):** state → `ground` or `air`. `|vx| = min(|vx|, max(runMaxEff, preDashSpeed))` (on ice: no clamp). `vy` stays 0, then gravity resumes.
- **Hitting a wall:** dash ends, `vx = 0`. Then the ledge grab check (§10) runs; if the player is airborne and holding toward the wall, wall slide rules apply.
- **Jump:** dash-jump (§6.4). **Dive slam:** §11. **Knockback:** §12.2.
- On every end: `dashReadyPt = pt + Math.floor(42 × dashCooldownMult + 0.5)` (round half up). `dashCooldownMult` is the product of all sources (05: Jammed ×2, Light Feet ×0.80): Jammed 84 ticks, Light Feet 34, Light Feet + Jammed 67.

### 7.4 Refund

`refundDash()`: `dashReadyPt = pt` and `airDashAvailable = true`. Every effect in other files that "refunds the dash" or "resets the dash cooldown" calls this (Wind kills and Shield parry in 02; Blademaster and Riposte Lv5 in 03).

---

## 8. Wall slide and wall jump

"Wall" = solid tile or non-one-way solid body. Spike tiles and one-way platforms are never walls.

### 8.1 Wall contact

The **gap** on side `S` is the number of empty pixel columns between the box and the nearest wall pixel, measured on the row `y - 14` (body center height). **Touching** = gap 0. **In wall-jump range** = gap 0–4 px (`WALL_JUMP_RANGE`).

### 8.2 Wall slide

- **Enter** (from `air`, also mid air-attack): airborne, `vy >= 0`, `moveX` points toward side `S`, touching a wall on `S`, and the ledge grab check (§10) did not trigger. An air attack in progress continues with its locked facing (§12.2); facing turns away from the wall when the attack ends or is cancelled.
- **During:** `vx = 0`; facing = away from the wall (except during an attack, above). `vy` uses gravity with cap 90 px/s (400 if `moveY = +1`); if above the cap, it drops at 2400 px/s². Air dash and double jump are **not** refreshed by sliding.
- **Leave:** landing (→ `ground`); `moveX` no longer toward the wall (→ `air`); no longer touching a wall at the body-center row (→ `air`); jump (wall jump); dash (air dash away from wall); dive slam (§11); a new attack press (02 §9.3: → `air`, facing away from the wall, then the attack starts). Whenever the wall is left without a wall jump, set `lastWallPt = pt`, `lastWallDir = S`.

### 8.3 Wall jump

- Direction `away = -S`. If walls are in range on **both** sides: jump away from the side `moveX` points to; if `moveX = 0`, away from the side the player faces. With only wall coyote, use `-lastWallDir`.
- `vx = 220 * away` (not scaled by `speedMult`), `vy = −400`, facing = away. During the 14-tick steering lock, **facing still follows `moveX`** (only velocity is locked), so the player can turn and attack back toward the wall. (Design decision, SPEC-GAP 1.)
- **Steering lock 12 ticks:** `vx` is not changed by input, accel, decel or decay. Gravity applies. Dash, double jump and dive slam are allowed during the lock (a dash ends the lock; a double jump does not).
- **Refreshes** `airDashAvailable = true` and `doubleJumpAvailable = true`. Cuttable. Peak 53 px; moves 22 px away during the lock.
- **Single-wall climbing is possible and intended:** wall jump, then (after the lock) hold toward the wall and double jump near the apex; this returns to the wall about 80 px higher every ~0.58 s. Level design (06) must use ceilings, not tall walls alone, to block areas.

---

## 9. Slide and crawl

### 9.1 Starting a slide

A dash start (§7.1) while **grounded** with `moveY = +1`, or any dash start from `crawl` (down not needed). Same cooldown and buffer as the dash. Does not use the air dash. Box becomes 12 × 14 immediately (shrinking is always allowed).

### 9.2 During the slide (36 ticks)

- `vx = dir * max(330, preSlideSpeed)` (same "never slows you" rule as the dash). Steering input ignored. `vy = 0` while grounded.
- I-frames for the first 18 ticks (`dashIframes = true`), none after. The low box keeps protecting against high attacks.
- **Slide-jump:** a jump is allowed only if the 12 × 28 box fits at the current position. If not, the press stays buffered.
- **Attack press:** when combat accepts a weapon press during a slide (02 §9.3: "an attack press ends the slide"), the slide ends on that tick with the natural-end rule (§9.3): clamp `|vx|` like the dash (§7.3; no clamp on ice); i-frames end; the dash cooldown starts; → `ground` if the 12 × 28 box fits, else `crawl`; emit `slideEnd`. The attack then starts from that state. A `cast` or `move` ability ends the slide the same way (03 §7.5).
- **Leaving the ground** (slide off a ledge): slide ends → `air`, `vx` kept (momentum rules), coyote starts, box regrows when it fits.
- **Hitting a wall:** slide ends, `vx = 0` → `ground` or `crawl`.

### 9.3 Ending and crawl

- **Natural end:** clamp `|vx|` like the dash (§7.3; no clamp on ice). If the 12 × 28 box fits → `ground`. If not (a ceiling is above) → **`crawl`**.
- **Crawl:** box 12 × 14. Horizontal rules §5.3 with max `CRAWL_MAX` (80 px/s × the other §5.2 factors) and ground rates. Jump: not allowed (press stays in the buffer). Dash → new slide if the cooldown is ready. Each tick, if the 12 × 28 box fits → `ground` (a buffered jump can then fire on the next tick). Walking off a ledge → `air` with the low box.

---

## 10. Ledge grab (automatic)

### 10.1 Trigger check (step 9, every tick)

All must hold:

1. State is `air`, `wallSlide`, or `dash` that hit a wall this tick (an air attack in progress is cancelled by the grab).
2. `vy >= 0`.
3. `moveX` points toward side `S`, or the dash direction is `S`.
4. There is a wall on side `S` with a gap of 0–2 px (§8.1 gap, measured at any row of the box), and a **ledge**: a wall tile/body whose top edge `L` satisfies `y - 24 <= L <= y - 5`, with no wall directly above it (the tile above that tile is not solid).
5. **Room:** with `F` = the wall face column, the rectangle from `F - 12` to `F + 14` (mirrored for a wall on the left), from `L - 28` to `L`, is free of solids, and the box snapped against the wall at the current `y` is free. (This covers the hang position, the climb path and the standing spot.)
6. Not rooted, not in `hurt`, `forced`, `minecart` or dive states.

Ledges exist on solid tiles and on solid bodies with `grabbable: true` (collapsing platforms). One-way platforms use the apex assist (§2.7) instead.

### 10.2 The climb (18 ticks, no collision checks)

- On grab: `vx = vy = 0`; snap `x` so the side edge touches the wall face; facing = toward the wall. Emit `ledgeGrab`. Box 12 × 28.
- Phase 1 (12 ticks): `y` moves linearly from the grab `y` to `L`, rounded to whole px each tick.
- Phase 2 (6 ticks): `x` moves linearly to the standing spot: center 8 px past the wall face (left edge 2 px onto the ledge).
- End: state `ground`, `vx = 0`. Air dash and double jump refresh (it is a landing).

### 10.3 Cancels

Jump or dash during the climb: snap instantly to the end position (standing on the ledge), then perform a ground jump (`vx = facing * runMaxEff`) or a ground dash/slide.

### 10.4 Reach for level design

| Move | Reach |
|---|---|
| Full jump (feet) | 56 px up |
| Full jump + ledge grab | ledge top up to 80 px (5 tiles) above the floor; 96 px (6 tiles) is not reachable |
| Full jump + double jump at apex (feet) | 96 px |
| Both jumps + ledge grab | ledge top up to 120 px (7 tiles yes, 8 tiles no) |
| Running jump, flat, full hold | 93 px horizontal |
| Dash-jump (jump on dash tick 1), flat | ≈138 px |
| Slide-jump, flat | ≈115 px |
| Air dash | 60 px, no height loss |

---

## 11. Dive slam

### 11.1 Start

- Input: `attack1.pressed` or `attack2.pressed` with `moveY = +1`, while airborne (including coyote time).
- Allowed from `air` (also during an air attack — it cancels it), `wallSlide`, `dash` (cancels the dash; dash cooldown starts). Not on a tick where a jump started.
- That weapon slot must hold a usable weapon. If it is empty, locked (Butterfingers, 05), or holds a thrown Storm Hammer that hasn't come back yet (02 §11), no dive slam starts and the press goes to combat as usual (for the thrown hammer, that recalls it).
- Combat (02) is told which slot started it; 02 owns damage, hitbox and weapon-specific effects (War Maul shockwave, Storm Hammer lightning).

### 11.2 Phases

| Phase | Ticks | Movement |
|---|---|---|
| `diveWindup` | 6 | `vx = 0`, `vy = 0` (hover) |
| `diveFall` | until it lands or hits | `vx = 0`, `vy = +600` constant, no cap, input steering ignored, no ledge grab, no wall slide |
| `diveLand` | 12 | `vx = 0`, `vy = 0` |

- **Hit:** the first tick 02 reports that the dive hitbox hit an enemy, boss, or a `bounceable` object (Lucky Blocks are bounceable): `vy = −360`, `vx = 0`, state → `air`, `airDashAvailable = true`, `doubleJumpAvailable = true`, not cuttable, `coyoteValid = false`. Bounces happen even if the target dies. Another dive slam can follow at once (bounce chains). 02's hit-stop runs after the velocity is set.
- **Landing** on solid, one-way platform, collapsing platform (makes it collapse at once, §13.5) or in water: → `diveLand` and emit `diveLand` (02 spawns the ground impact).
- **Cancels:** during windup/fall, a jump runs the normal jump priority (usually double jump or wall jump) and a dash starts an air dash, if available. During `diveLand`, jump or dash cancel it (ground jump / ground dash / slide).
- No limit on dives per airtime.

---

## 12. Interfaces for combat and abilities

### 12.1 MoveModifiers

Recomputed each tick by other systems before step 5.

```ts
interface MoveModifiers {
  speedPercents: number[];        // e.g. [+0.20, +0.25, -0.20]; summed in §5.2 (Rush adds its level's value here)
  actionMoveMult: number;         // ground move cap of the current attack/charge/drink/shield/cast (§5.2); 1 if none
  statusMult: number;             // 0.70 while Chilled (02 §5.4), else 1
  gravityMult: number;            // air gravity factor from a cast (03 §7.6); 0 = hover; 1 if none
  facingLocked: boolean;          // set by combat/abilities per §12.2
  canJump: boolean;
  canDoubleJump: boolean;         // false under Heavy Feet (05)
  canDash: boolean;
  dashCooldownMult: number;       // product of sources: Jammed ×2, Light Feet ×0.80 (05); applied in §7.3
  rooted: boolean;                // e.g. Treant roots (04): vx = 0, no jump/dash/slide; falls normally
  maxFallOverride: number | null; // e.g. Eagle Eye aiming (03)
}
```

### 12.2 Attacks, knockback, impulses

- **Attack cancels:** jump and dash are always accepted during any attack phase and cancel it (§3 step 5). Ledge grab cancels an air attack.
- **Facing:** at the start of each weapon step and each cast the player turns to `moveX` if it is not 0; facing is then locked until that step or cast ends (02 §9.3, 03 §7.6), and while the shield is up (02 §12). Facing is **not** locked (it follows `moveX`) while charging (02 §9.4) and during the Giant Axe spin (02 §10.5). Combat and abilities report the lock as `MoveModifiers.facingLocked`; step 10 does not change facing while it is true. A cancel unlocks it.
- **Knockback:** `applyKnockback(vx, vy, stunSeconds)` (values from 02). Ends any state except `minecart` and `dead`; sets the velocity; state `hurt` for the stun. In `hurt`, input is ignored for movement, horizontal uses the no-input decel, gravity applies. Whether dash/jump can cancel hurt-stun is decided by 02. In `minecart`, knockback is ignored (the player stays in the cart).
- **Impulse:** `applyImpulse({ vx?, vy?, mode: 'add' | 'set', lockSeconds? })` for weapon recoil (Hand Cannon), uppercut launch (Iron Fists), etc. (02 gives values). Not cuttable, does not refresh anything, sets `coyoteValid = false` if `vy < 0`. Extra speed above max decays by the momentum rules. `lockSeconds` uses the same steering lock as the wall jump.

### 12.3 ForcedMove (dash-like abilities and weapon moves)

```ts
interface ForcedMove {
  vx: number; vy: number;               // px/s, constant unless gravity is true
  durationS: number;
  gravity: boolean;
  endOnWall: boolean;                   // end on horizontal collision
  target?: { x: number; y: number };    // pull toward a point instead of vx/vy (grapple)
  speed?: number;                       // with target: px/s along the line
  arriveDist?: number;                  // with target: end when center is this close (default 12)
  endVelocity: 'keep' | 'clampToRun' | 'zero';
  cancelByJump: boolean; cancelByDash: boolean;
}
```

- Used by 03 (Blade Dash, Whirlwind, Shoulder Charge, Grapple Arrow pull) and 02 (Spear lunge, Katana dash-slash). Those files give the numbers.
- State `forced`; box unchanged from the previous state; collides with solids normally; corner step-up applies; no ledge grab or wall slide; does not use or refresh the air dash unless the caller calls `refundDash()`.
- `clampToRun` = the dash's natural-end clamp (§7.3).

### 12.4 Teleport

`teleport(dx, dy)` (Blink, 03): target = current position + `(dx, dy)`. If the box at the target is free, go there. Otherwise step back toward the start 1 px at a time until a free box is found (this lets it pass through thin walls). The line may not cross a solid body with `noTeleport: true` (doors, arena gates, timed doors; set in 06) or leave the active camera bounds (§14); the target is first clamped to just before such a body or edge. If no free spot exists, the teleport fails (03 decides the refund). After: `vy = 0`, `vx` kept, grounded check runs.

---

## 13. Special surfaces and movement objects

Runtime shapes are below; how they are written in Tiled is defined in 06.

```ts
type TileKind = 'empty' | 'solid' | 'oneway' | 'ice' | 'water'
              | 'spikeUp' | 'spikeDown' | 'spikeLeft' | 'spikeRight';

interface SolidBody { id: string; x: number; y: number; w: number; h: number;
  oneWay: boolean; surface: 'normal' | 'ice'; grabbable: boolean; noTeleport: boolean; active: boolean; }

interface CollapsingPlatformDef { x: number; y: number; w: number; h: 16;  // tile-aligned
  oneWay: boolean; collapseDelay: number /* s, default 0.5 */; respawnTime: number /* s, default 4.0; 0 = never */; }

interface MinecartDef   { x: number; y: number; dir: 1 | -1; }   // spawn, feet position
interface MinecartStopDef { x: number; y: number; w: number; h: number; }
interface GrapplePointDef { x: number; y: number; }              // hook center
```

### 13.1 One-way platforms

- Tile kind `oneway` (top edge = tile top) or a `SolidBody` with `oneWay: true`. Rule §2.6.
- **Drop-through:** a fresh jump press with `moveY = +1` while grounded and **every** support is one-way: `y += 1` (feet now 1 px inside the platform, so §2.6 no longer applies), state → `air`, `vy = 0`, `coyoteValid = false` (no coyote jump after dropping). If any support is solid, it is a normal ground jump instead. Buffered presses never drop through.
- Dive slam and the minecart land on one-way platforms.

### 13.2 Swamp water (Dark Forest & Swamps)

- Tile kind `water`, non-solid; the swamp floor below it is solid. All water is wading depth (no swimming).
- **In water** = the point `(x, y - 1)` is inside a water tile.
- Effects while in water and **not** in `dash`, `slide`, `forced` or `minecart`: `surfaceMult = 0.5` (run max 85 px/s at ×1.0); ground jump `vy = −340` (38.5 px); airborne max fall 160 px/s.
- Dash and slide work at full speed in water. Their natural-end clamp uses the water `runMaxEff`. Speed above the water max decays at the normal overspeed rates.
- Emit `enterWater` / `exitWater` on change (for splash VFX/SFX in 08).

### 13.3 Ice (Caves & Mountains peaks)

- Tile kind `ice` (solid), or a solid body with `surface: 'ice'`.
- **On ice** = grounded and the support pixel under `(x, y)` is ice; if no support there, use the support under the box edge nearest to `x`.
- Ground rates on ice: accel 450, decel (no input) 200, turn 900, overspeed decay 120 (px/s²). Run max unchanged.
- Dash and slide natural ends do **not** clamp on ice, so their speed carries and slowly decays. Air rules are unchanged after jumping off ice. Walls made of ice are normal walls.

### 13.4 Spikes

- Tile kinds `spikeUp`/`spikeDown`/`spikeLeft`/`spikeRight` (named by where the points face). Non-solid. Hurt zone inside the 16 × 16 tile at `(tx, ty)`:

| Kind | Hurt zone | Pop |
|---|---|---|
| `spikeUp` | x `tx+2..tx+14`, y `ty+8..ty+16` | `vy = −330` (36 px), `vx` kept but clamped to `±runMaxEff` |
| `spikeDown` | x `tx+2..tx+14`, y `ty..ty+8` | `vy = +150`, `vx` kept |
| `spikeLeft` | x `tx..tx+8`, y `ty+2..ty+14` | `vx = −220`, `vy = −200`, steering lock 14 ticks |
| `spikeRight` | x `tx+8..tx+16`, y `ty+2..ty+14` | `vx = +220`, `vy = −200`, steering lock 14 ticks |

- **Check** (step 9): if the hurtbox overlaps any hurt zone and the player is not in hurt i-frames (02): deal **20 damage** through 02's damage-taken pipeline as source `hazard` with death cause `'spikes'` (06 §6.1) (not stage-scaled; Glass Bones and one-hit curses still apply, 02/05). Start 02's hurt i-frames, but **not** 02's knockback or hurt-stun: the player keeps control. Apply the pop of the zone with the largest overlap (tie order: Up, Left, Right, Down). Any state except `minecart`/`dead` ends → `air`. Not cuttable; does not refresh air dash or double jump. Emit `spikeHit`.
- Dash, slide, parry, weapon-move (Katana dash-slash, Spear lunge) and ability i-frames do **not** protect from spikes. Only hurt i-frames do (including Second Wind's 2.0 s): while they last, the player can stand in or walk across spikes. Spikes also skip 02's hit-stop (02 §5.2 table).
- In the minecart: damage and i-frames apply, no pop, the player stays in the cart.

### 13.5 Collapsing platforms (King's Castle bridges, anywhere else)

- A tile-aligned `SolidBody` group (1 tile tall, any width), `grabbable: true`.
- **Trigger:** the player (or the minecart) is supported by it at step 9 → starts shaking for `collapseDelay` (default 0.5 s). A dive slam landing on it → collapses at once. Triggers are permanent: jumping off does not stop it. Enemies never trigger it.
- **Collapse:** `active = false` (non-solid) immediately; a falling visual drops with gravity and fades after 1 s. A player standing on it falls and gets coyote time.
- **Respawn** after `respawnTime` (default 4.0 s; 0 = never), but only on a tick when neither the player's box nor the cart overlaps its rectangle.
- **Time Slow:** `collapseDelay` and `respawnTime` count down by `TICK × worldTimeScale` each tick (in ticks: start at `Math.round(s × 120)` and subtract `worldTimeScale`; 1.0 normally, 0.35 under Time Slow, 03 §11.4); the platform collapses or respawns on the first tick the counter is ≤ 0. The minecart is not slowed.
- At 170 px/s a player crosses 85 px (5.3 tiles) during the default 0.5 s delay.

### 13.6 Minecart (Caves & Mountains)

| Number | Value |
|---|---|
| Cart box | 24 × 14 px, feet at the bottom center |
| Accel / top speed | 800 px/s² up to 260 px/s in `dir`; it never slows by itself or reverses |
| Gravity / max fall | 1500 px/s² / 520 px/s |
| Cart jump | `vy = −420` (59 px), cuttable (×0.45), coyote 0.10 s, uses the jump buffer |
| Crash throw | player `vx = cart vx`, `vy = −300` (30 px) |
| Respawn | a new cart appears at the spawn 2.0 s after the old one crashes |

- **The cart** moves with the same pixel-step collision as the player (it lands on solid and one-way ground, bonks ceilings). Rails are only art (08). It passes through enemies and does no damage.
- **Boarding:** a cart waits at its spawn until boarded, then starts accelerating. Press interact while overlapping a cart, or land on it (falling with the feet crossing the cart's top while overlapping it horizontally). State `minecart`; the player is locked to the cart (feet = cart feet − 8, centered); air dash and double jump refresh.
- **Riding:** `moveX` does nothing. Attacks are allowed (02 attack data; no move cap, `actionMoveMult` is 1). Dive slam is not allowed. Knockback is ignored. Spikes: §13.4. Water does not slow the cart. The cart triggers collapsing platforms.
- **Exits:**
  - Jump while the cart is grounded (or in cart coyote) → **cart jump** (player stays in).
  - Jump while the cart is airborne → player leaves with a double jump (`vy = −346`, `vx = cart vx`); needs `doubleJumpAvailable`.
  - Dash → player leaves with a normal dash in `moveX` direction (else the cart's `dir`), speed `max(400, cart speed)`; air dash rules apply if the cart is airborne.
  - Any `ForcedMove` or teleport from an ability → player leaves first, then it runs.
  - **Crash:** the cart hits a wall or enters a `MinecartStop` rectangle → the cart breaks; the player is thrown (table), state `air`, air dash and double jump refresh, box regrows (push-out if needed). Emit `cartCrash`.
- An empty cart keeps rolling until it crashes, then respawns.

### 13.7 Grapple points (Dark Forest vines, other skip routes)

- A `GrapplePointDef` is a hook/vine anchor drawn as a 16 × 16 sprite centered on `(x, y)`. It does nothing unless the player uses Grapple Arrow (03 gives range, aim rules, pull speed, cooldown). The main path must never require one.
- The pull is a `ForcedMove` with `target` = the point, gravity off, `endOnWall` true, `arriveDist` 12, `cancelByJump` and `cancelByDash` true.
- **Arrival at a grapple point:** `vx = 200 * sign(point.x - startX)` (0 if the horizontal distance at start was under 8 px), `vy = −250` (21 px hop), state `air`, not cuttable, and `airDashAvailable = doubleJumpAvailable = true`.
- **Arrival at a wall** (Grapple Arrow hit a wall, 03): `vx = vy = 0`, state `air` (wall slide starts next tick if holding toward the wall). No refresh.
- Blocked before arriving: the move ends with `endVelocity: 'zero'`.

### 13.8 Stuck javelin platform

When a thrown Javelin sticks in a wall (02 decides when and how long it stays), it adds a one-way `SolidBody` 24 px wide and 4 px tall, extending out from the wall face, with its top at the javelin's center height − 2 px. It is removed when the javelin is removed. Standing on it follows the one-way rules (including drop-through).

### 13.9 Doors and other solid bodies

Arena doors, timed doors, cracked walls and similar are plain `SolidBody` entries (06 and 03 define when they appear or break). When one becomes active on top of the player, push-out (§2.8) runs.

---

## 14. Camera

Camera math is a pure function in `src/core/camera.ts` (updated every tick, testable); the Phaser layer copies the result to its camera. Viewport 640 × 360.

### 14.1 Numbers

| Name | Value |
|---|---|
| Look-ahead target | `clamp(vx * 0.35, -80, 80)` px; if `abs(vx) < 10`: `facing * 24` |
| Look-ahead change rate | 240 px/s (linear toward the target) |
| Feet offset | feet sit 40 px below the screen center (screen y 220) |
| Air up-slack | 80 px |
| Fall look-down | +64 px when (`vy >= 300` **and** the feet are below the last grounded height, i.e. `y > lastGroundY`) or in `diveFall`, else 0; changes at 300 px/s. A normal jump that lands at or above its takeoff height never dips the camera (design decision, SPEC-GAP 3) |
| Smoothing | exponential, time constant 0.08 s (x), 0.12 s (y): `c += (desired - c) * (1 - exp(-TICK / tau))` |
| Edge margins | the player box stays ≥ 64 px from the left/right screen edges and ≥ 48 px from the top/bottom edges (near a level edge the bounds clamp wins) |
| Bounds blend | 0.4 s |
| Snap distance | 160 px |
| Shake max | 8 px |
| Shake levels (02 §4.6) | `small` = `shake(2, 0.12)`; `medium` = `shake(4, 0.25)` |

### 14.2 Each tick

1. **Anchor Y** (`anchorY`): set to the player's feet `y` when grounded, in `wallSlide`, `ledgeClimb`, or in a grounded minecart. While airborne: if `y > anchorY` → `anchorY = y` (follow falls at once); if `y < anchorY - 80` → `anchorY = y + 80`. Small jumps do not move the camera vertically.
2. **Desired center:** `dx = x + lookX`, `dy = anchorY - 40 + lookDown`. In the minecart, `vx` is the cart's.
3. **Smooth** toward the desired center (table).
4. **Edge margins:** move the camera the minimum needed so the player box respects the margins.
5. **Clamp** the 640 × 360 view inside the active bounds. If the bounds are smaller than the view on an axis, center the view on that axis.
6. **Round** the scroll to whole pixels.
7. **Shake** (§14.4) is added after clamping.

### 14.3 Bounds and snapping

- **Active bounds** = the level rectangle, unless the player is inside a camera zone (`CameraZoneDef { x, y, w, h, mode: 'always' | 'whileLocked' }`). `always` zones apply whenever the player's center is inside. `whileLocked` zones (arenas, boss arenas) apply only while 06 reports that arena locked. The Dragon side arena has no locking zone.
- When the active bounds change, each edge of the clamp rectangle moves linearly from the old to the new value over 0.4 s.
- **Snap** (no smoothing, no blend, look-ahead reset): stage start, after restart, after sleeping at an inn, scene changes, and any single-tick player move larger than 160 px.
- The camera never shows outside the active bounds (before shake). Shake can show up to 8 px beyond; the Phaser layer fills that with the biome background color.
- The camera has no effect on gameplay.

### 14.4 Screen shake

`camera.shake(amplitudePx, durationS)` is called by other systems (02 for big hits, 04 for boss slams, etc.). 02's named levels map to calls through the §14.1 table: `small` = `shake(2, 0.12)`, `medium` = `shake(4, 0.25)`. While shakes are running, the amplitude used is the largest of `A * remaining / duration` among them (capped at 8 px). Each tick, offset x and y = `round((rand * 2 - 1) * amplitude)` using the `cosmetic` RNG stream. If screen shake is turned off in settings (07), the offset is always 0. During the player's hit-stop the camera holds still except for shake.

---

## 15. Data and events

```ts
type MoveStateId = 'ground' | 'air' | 'dash' | 'slide' | 'crawl' | 'wallSlide' | 'ledgeClimb'
  | 'diveWindup' | 'diveFall' | 'diveLand' | 'hurt' | 'forced' | 'minecart' | 'dead';

interface PlayerBody {
  x: number; y: number; remX: number; remY: number;   // §2.1
  vx: number; vy: number;
  w: 12; h: 28 | 20 | 14;
  facing: 1 | -1;
  state: MoveStateId; stateTicks: number; pt: number;
  grounded: boolean; inWater: boolean; onIce: boolean;
  airDashAvailable: boolean; doubleJumpAvailable: boolean; jumpCuttable: boolean;
  coyoteValid: boolean; lastGroundPt: number; jumpPressPt: number; jumpPressFresh: boolean;
  dashPressPt: number; dashReadyPt: number; lastWallPt: number; lastWallDir: 1 | -1;
  steerLockTicks: number; dashIframes: boolean; preDashSpeed: number;
}

type MoveEvent = 'jump' | 'doubleJump' | 'wallJump' | 'land' | 'dashStart' | 'dashEnd'
  | 'slideStart' | 'slideEnd' | 'ledgeGrab' | 'diveStart' | 'diveLand' | 'diveBounce'
  | 'spikeHit' | 'enterWater' | 'exitWater' | 'cartBoard' | 'cartJump' | 'cartCrash'
  | 'platformShake' | 'platformCollapse' | 'dropThrough';
```

Events are pushed to a per-tick list on the core state; audio (08), VFX (08) and combat (02, e.g. Rush meter) read them. `window.__game` (README) exposes `PlayerBody` and the camera state.

---

## Test checklist

All tests run in Vitest on `src/core` with a flat test level (solid floor) unless stated; heights and distances ±1 px.

1. A full jump from standing (jump held) peaks 56 px above the start, on tick 33 (±1) after the press.
2. A jump held for exactly 1 tick peaks 14 px; a 1-tick double jump rises 10 px.
3. A held double jump used at the apex of a full jump peaks 96 px above the floor.
4. Running from standstill reaches 170 px/s on the 12th tick; releasing at 170 px/s on the ground stops within 9 ticks.
5. A ground dash moves exactly 60 px over 18 ticks; `dashIframes` is true on those 18 ticks and false on the 19th.
6. During an air dash `vy` is 0 every tick and the player's `y` does not change.
7. A second air dash in the same airtime is refused; after landing, a dash is refused until 42 ticks after the first dash ended.
8. A dash pressed 6 ticks before the cooldown ends fires on the first tick the cooldown is over; one pressed 13 ticks before does not fire.
9. With `speedMult` 1.45, run speed is 246.5 px/s but dash distance is still 60 px and jump height still 56 px.
10. A slide moves 99 px over 36 ticks with a 12 × 14 box and passes through a 1-tile-high (16 px) tunnel; standing up is refused while the ceiling is above.
11. A slide that ends under a 1-tile ceiling enters `crawl`; the player becomes `ground` on the first tick the 12 × 28 box fits.
12. After walking off a ledge, a jump pressed on the 12th tick after the last grounded tick is a ground jump (double jump still available); on the 13th tick it is a double jump.
13. With no double jump left, a jump pressed 10 ticks before the landing tick fires on the tick after landing; one pressed 12 ticks before the landing tick does not (a press on tick P is usable on ticks P to P + 11).
14. A dash-jump (jump on dash tick 1) on flat ground lands 136–140 px from the jump point; a running jump at 170 px/s lands 92–94 px away.
15. Max fall speed is 400 px/s, 520 px/s while holding down, 90 px/s in wall slide, 160 px/s in swamp water.
16. A wall jump without release rises 53 px (±1), moves 22 px (±1) away during the 12-tick lock, and sets both `airDashAvailable` and `doubleJumpAvailable` to true.
17. A jump pressed in the air with a 4 px gap to a wall is a wall jump; with a 5 px gap it is a double jump.
18. Jumping beside a wall while holding toward it, with the apex leaving the feet 10 px below the wall's top, triggers a ledge grab at the apex; 18 ticks later the player is `ground` on the ledge. With a ceiling 20 px above the ledge, no grab happens.
19. A ledge 80 px above the floor can be reached with one full jump; a ledge 96 px above cannot (without double jump).
20. Rising with the head overlapping a ceiling corner by 4 px nudges the player sideways and the jump continues; at 5 px it bonks (`vy` becomes 0).
21. A dive slam hovers 6 ticks, then falls at 600 px/s; on an enemy hit `vy` becomes −360 and both refreshes are set; on the ground it enters `diveLand` for 12 ticks, and a jump cancels it.
22. Down + jump on a one-way platform drops through it; down + jump on solid ground is a normal jump; rising from below through a one-way platform is not blocked, and falling onto it lands.
23. Touching `spikeUp` deals 20 damage, sets `vy` to −330 and starts hurt i-frames; touching it during a dash still deals damage; touching it during hurt i-frames deals none.
24. In swamp water run max is 85 px/s, a ground jump peaks 38–39 px, and a dash still moves 60 px.
25. On ice, after a slide ends while holding forward, speed stays above 170 px/s and drops by 1 px/s per tick (120 px/s²).
26. A collapsing platform becomes non-solid 60 ticks after the player first stands on it and becomes solid again 480 ticks later; it stays non-solid while the player overlaps its rectangle.
27. A minecart reaches 260 px/s; hitting a `MinecartStop` throws the player with `vx` 260 and `vy` −300.
28. Falling from 2000 px onto the floor causes no damage.
29. Holding left, then also pressing right gives `moveX = +1`; releasing right gives `moveX = −1`. A press and release between two ticks gives `pressed = true, held = false` on the next tick.
30. Feeding the same 10,000-tick input recording twice gives identical `PlayerBody` and camera state every tick; the camera view never extends past the level bounds before shake.
31. With the player in a 12-tick hit-stop and the dash cooldown ready, a dash pressed on hit-stop tick 3 ends the hit-stop and the player moves with the dash on that same tick. With the dash on cooldown, the same press does not end the hit-stop (it runs all 12 ticks) and stays buffered.
32. On the ground, a heavy weapon step caps run speed at 42.5 px/s (170 × 0.25) and drinking caps it at 68 px/s. The same heavy step in the air after a dash-jump, holding forward, does not cap speed: `vx` only decays at 600 px/s². During the Hand Cannon recovery there is no cap.
33. While Chilled, run max is 119 px/s. At Rush level 3 with Swift, `speedMult` is 1.40 and run max is 238 px/s.
34. An attack press during a slide on open floor ends the slide that tick: `dashIframes` false, state `ground`, `|vx|` clamped to 170 (not on ice), dash cooldown started. Under a 1-tile ceiling the slide ends in `crawl`.
35. The dash cooldown is 42 ticks; with `dashCooldownMult` 0.8 it is 34, with 1.6 it is 67, with 2 it is 84.
36. A death caused by spike damage reports death cause `'spikes'`.
37. With `worldTimeScale` 0.35 for the whole delay, a collapsing platform becomes non-solid 172 ticks (not 60) after the player first stands on it. A minecart's speed is unchanged.
38. A `small` shake starts at amplitude 2 px and lasts 14 ticks; a `medium` shake starts at 4 px and lasts 30 ticks.
39. After dying in the air, the body falls (max 400 px/s) and lands on the floor; it passes through a spike zone with no `spikeHit` event and does not trigger a collapsing platform. Input has no effect.
40. Entering wall slide during an air attack keeps the attack's facing (toward the wall); facing turns away from the wall on the tick the attack ends.
41. Falling at any speed onto a floor whose top is pixel row Y always stops with the feet at `y = Y` (no 1-px gap or sink).
