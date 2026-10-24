# 07 — UI, HUD and Controls

This file defines everything the player reads or presses outside the game world's rules: the HUD, world-anchored labels, every popup and screen, fonts, UI colors, default controls, rebinding and settings. Read `00-README.md` first (640 × 360, 120 ticks/s, architecture).

**This file owns:** HUD layout (exact pixels); fonts and sizes; UI colors (including grade colors); every screen and popup; damage numbers; enemy HP bars and notice marks (drawing); the weapon swap choice; default controls (keyboard + gamepad); rebinding; input prompt icons; the settings and their stored shape.

**Not here (only referenced):** `InputState` and snapshot latching: `01-movement.md` §1. Camera and shake strength: 01 §14. Hit events, flask, Rush, Storm Hammer recharge, charge weapons: `02-combat.md`. Class state, `displayName`, the link window, the ability swap choice rules: `03-classes-abilities.md`. Enemy awareness, `hpBar`, boss bar data, Break: `04-enemies-bosses.md`. Item names, prices, Lucky Block and curse effects, shop rules, stat upgrade texts: `05-loot-economy.md`. Run phases, transitions and fades, timer and time formats, splits, personal bests, restart hold, death flow, route choice, villages and their objects, practice, seeds, save storage, export codes: `06-run-levels-save.md`. Sprites, icon art, the font PNGs, sounds, VFX: `08-art-audio.md`.

**Code:** Phaser drawing in `src/ui/` (one `UIScene` running above the stage scene). Pure logic that tests need (bindings, the HUD model, damage-number merging, layout constants) lives in `src/ui/model/` and **must not import Phaser**; Vitest covers it. Layout numbers: `src/ui/model/layout.ts`. Colors: `src/ui/model/theme.ts`. Text: `src/ui/model/strings.ts` (English only in v1). The weapon swap choice is game logic and lives in `src/core/`.

---

## 1. Basics

### 1.1 Drawing rules
- All UI is drawn in the 640 × 360 game resolution (README scaling). Every position is a whole pixel (`Math.round`). No UI element is ever scaled by a non-integer factor.
- The HUD is fixed to the screen: it ignores camera scroll and screen shake.
- **World-anchored UI** (damage numbers, enemy bars, marks, prompts, cards, price tags) is drawn at `screen = round(world − cameraScroll)`, where `cameraScroll` already includes the shake offset (01 §14.4). So it moves with the world, shake included.
- Until 08's art exists, every atlas frame in §3.4 is drawn as a rectangle of its size in `textDim` with a 1 px `ink` border.

### 1.2 Layers (depth inside `UIScene`)
900 enemy HP bars and notice marks · 910 damage numbers · 920 item badges, prompts, cards, price tags, charge bar, dummy DPS, hints · 1000 HUD · 1100 banners, alerts, toasts, restart ring · 1200 popups that freeze the world (stat pick, route choice, class pick) · 1300 full-screen fades (06 §2.2 lengths; drawn here so they cover the HUD but not menus) · 1400 menus and end screens · 2000 debug overlay (`?debug=1`).

### 1.3 Time base
- UI animations (fades, blinks, number rises) use **real elapsed frame time**, clamped to 0.1 s per frame, and **freeze while the game is paused**. They never change core state and never use core RNG streams.
- UI randomness (damage-number jitter) uses its own `mulberry32` seeded with `1` when `UIScene` starts. Never `Math.random()`.
- Blink "at N Hz" means visible for `1/(2N)` s, then hidden for `1/(2N)` s, starting visible.

### 1.4 Reading the core
- Every rendered frame, `src/ui/model/hudModel.ts` builds one `HudModel` (§4.15) from the latest core state. It is the **only** UI file that knows other modules' field names. Every HUD drawing function takes `HudModel` (and settings) only, so tests can build a `HudModel` by hand.
- The game layer collects the per-tick event lists (01 §15) of **every tick run this frame** into one list and hands it to the UI once per frame. The UI reacts to: 02's hit event (§4.6); `abilityUsed`, `abilityLinked`, `abilityFizzle`, `abilityNotReady`, `classChanged`, `classDiscovered`, `lockpickUsed` (03); `bossDefeated` (04); `luckyResult`, `curseApplied`, `curseLifted`, `goldChanged`, `purchase`, `keysFull`, `blueprintFound` (05); `stageStarted`, `enterVillage`, `split`, `pbSaved`, `dragonWarning`, `playerDied`, `runCompleted`, `saveFailed` (06); and `healRefused {reason: 'noCharge' | 'fullHp' | 'blocked' | 'hitstun'}` from the flask (02 §7.2).
- The core exposes `interactTarget`: the object an interact press would act on this tick, chosen with 06 §11.1's rule (nearest center x, then lower id).

### 1.5 What stops what
06 §2.1 owns phases. This is how each UI surface fits them:

| Surface | 06 phase | World | Run timer | Input |
|---|---|---|---|---|
| Title, practice setup, records, settings, controls | `title` | no | no | menu reading (§7.1) |
| Pause menu (+ settings, controls opened from it) | `paused` | no | **no** | menu reading |
| Stat pick, route choice | `statPick`, `routeChoice` | frozen | yes | menu reading for the popup; the core still reads `restart` |
| Class pick, seed entry (Home Village) | `homeVillage` | runs | no (run not started) | menu reading; the core gets a neutral `InputState` |
| Death screen, run summary, practice result | `dead`, `runComplete` | frozen | no | menu reading (the core still reads `restart` in `dead`) |
| Item cards, swap choices, shop tags, banners, alerts, toasts, hints | unchanged | runs | yes | normal gameplay |

- A neutral `InputState` has every button `held/pressed/released = false` and `moveX = moveY = 0`.
- **Input swallow:** when any surface that used menu reading closes, every button held at that moment counts as **not held and not pressed** for the core until it is released. (Pressing Jump on "Resume" or on a stat card never also makes the player jump.)

---

## 2. Fonts and text

### 2.1 Font files
Generated bitmap fonts (AngelCode BMFont XML + PNG), made by 08's `tools/` pipeline from a glyph table drawn in the script (5 × 7 dot-matrix style). No external font file, so no license or download. Loaded with Phaser's `bitmapFont` loader, drawn with `BitmapText`, colored with multiply tint (white fill × tint; the ink outline stays ink).

| Key | Files (in `public/assets/fonts/`) | Cap height | x-height | Descender | Letter gap | Space advance | Line height | Outline |
|---|---|---|---|---|---|---|---|---|
| `rb_small` | `rb_small.png`, `rb_small.xml` | 7 px | 5 px | 2 px | 1 px | 4 px | 11 px | 1 px `ink`, all 8 neighbors |
| `rb_small_plain` | `rb_small_plain.png`, `rb_small_plain.xml` | 7 | 5 | 2 | 1 | 4 | 10 | none |
| `rb_large` | `rb_large.png`, `rb_large.xml` | 14 | 10 | 4 | 2 | 8 | 22 | 1 px `ink` (glyphs are `rb_small` scaled ×2, then outlined) |

- Glyph widths: letters 1–5 px (`rb_large`: ×2). **Digits are all exactly 5 px** (advance 6; large 10, advance 12), so numbers never jitter.
- Outlined glyph images are 2 px larger than the glyph; the BMFont `xoffset`/`yoffset` is −1 so the advance is unchanged.
- **Charset:** ASCII 32–126, plus `×` `·` `−` (U+2212) `—` (U+2014) `±` `←` `↑` `→` `↓` `▸` `★` `…`. Negative numbers always use `−`.
- `rb_large` is the largest font. The title logo is `rb_large` drawn at integer scale ×2.

### 2.2 Text placement
- "Text at (x, y)" = the **top-left of the cap box** of the first glyph (the outline sits 1 px outside it). "Right-aligned at x" = the right edge of the last glyph's cap box is at x. "Centered at x" = left edge at `round(x − width / 2)`.
- Default: `rb_small`, color `text`. Text on panels may use `rb_small_plain`.
- Wrapping: break at spaces to fit the given max width; a single word wider than that is hard-broken. No hyphens.
- A string with a character outside the charset is a bug: dev builds log `console.warn` naming it.

### 2.3 Formats
- Times and deltas: 06 §5.1's `formatTime` and `formatDelta` (one shared implementation).
- Gold: plain integer, no separators (max 9999, 05 §9.1).
- Countdown seconds: `ceil(ticks / 120)` (1 tick left shows `1`).

---

## 3. Colors

All colors are tokens in `src/ui/model/theme.ts`. 08's UI palette must use these same hex values.

### 3.1 UI tokens

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0d0b14` | Outlines, bar borders, cooldown shade (alpha 0.7) |
| `panel` | `#1b1826`, alpha 0.90 | Card, popup and menu backgrounds |
| `panelBorder` | `#4a4560` | Panel borders, unlit class icons |
| `text` | `#f2efe6` | Main text, damage numbers, HP lag |
| `textDim` | `#9d98b0` | Secondary text, neutral ability frame, "No Class" |
| `textOff` | `#5c5870` | Disabled items |
| `slotEmpty` | `#3a3648` | Empty frames, empty pips |
| `good` | `#5ce06a` | Ahead of PB, buffs, heals, positive deltas |
| `bad` | `#ff4a4a` | Behind PB, debuffs, can't afford, not ready, player damage |
| `highlight` | `#ffd34a` | Cursor, selection, link, bond, level pips, poise, best marks |
| `hp` / `hpLow` | `#e5404a` / `#ff7080` | HP fills / low-HP pulse |
| `flask` | `#ff8fa0` | Flask fill bar |
| `rush1` / `rush2` / `rush3` | `#ffd34a` / `#ffa83a` / `#ff5a3a` | Rush segments 1–3 |
| `curse` | `#d0306a` | Curse frame and text |
| `barrier` / `ward` | `#6fe3ff` / `#c8a0ff` | Enemy bar frames (Goblin Shaman barrier, Castle Mage ward) |
| `elite` | `#ffc93c` | Elite bar frame |
| `crit` | `#ffe94a` | Crit numbers |
| `dim` | `#000000`, alpha 0.55 | Darkening behind popups and menus |

### 3.2 Grade colors

| Grade | F | C | B | A | S |
|---|---|---|---|---|---|
| Color | Gray `#9b9ba6` | Green `#5ad16a` | Blue `#4a9dff` | Purple `#b264ff` | Gold `#ffc93c` |

### 3.3 Class, hybrid, element and Dragon colors
- **Classes:** Swordsman `#ff5a5a` · Tank `#ff9a3c` · Archer `#a8d846` · Wizard `#42d9ff` · Neutral `#9d98b0`.
- **Hybrids:** Thief `#c0a8ff` · Gladiator `#ff7f50` · Spellblade `#ff6ad5` · Warden `#d8b060` · Thunderlord `#ffe24a` · Arcane Archer `#6af0c8`.
- **Elements:** Fire `#ff7a2e` · Ice `#8fdcff` · Lightning `#ffe94a` · Poison `#78d94a` · Wind `#b9f2dc` (the same hex as 08 §3.5's world main colors, so a damage number matches its element's VFX).
- **Dragon text:** Red `#ff5a3a` · White `#e8f4ff` · Storm `#ffe94a` · Green `#8ee04a`.

### 3.4 UI atlas (made by 08)
`public/assets/ui/ui.png` + `ui.json` (Phaser atlas JSON). Frames marked (tint) are white shapes the UI tints; all others are full color.

| Frame | Size | Count |
|---|---|---|
| `icon_weapon_<WeaponId>` | 16 × 16 | 19 |
| `icon_ability_<AbilityId>` | 16 × 16 | 17 |
| `icon_stat_<StatUpgradeId>` | 16 × 16 | 12 |
| `icon_class_<ClassId>` | 16 × 16 | 4 |
| `class_<ClassId>` (tint) | 6 × 6 | 4 |
| `elem_<ElementId>` | 7 × 7 | 5 |
| `effect_<LuckyId>` (12 lasting effects, not `jackpot`/`ambush`), `effect_curse_<CurseId>` | 10 × 10 | 16 |
| `status_<PlayerStatusId>` | 8 × 8 | 4 |
| `hud_flask_full`, `hud_flask_empty`, `hud_flask_blocked` (overlay) | 10 × 12 | 3 |
| `hud_coin` 8 × 8, `hud_key` 7 × 10, `hud_lockpick` 8 × 10, `hud_link` 8 × 7, `hud_lock` 8 × 8, `hud_dragon_arrow` 12 × 12 (points right) | — | 6 |
| `prompt_ps_cross`, `_circle`, `_square`, `_triangle` (tint) | 7 × 7 | 4 |
| `hud_heart` 10 × 10, `hud_plate_9` 24 × 24 (9-slice, 8 px corners) | — | 2 |
| Popup skin: `panel_9` 24 × 24 (9-slice, 8 px corners: dark fill, carved border), `panel_9_edge` 24 × 24 (tint: #ffffff border only, drawn over `panel_9` in the grade or class color), `tab_on_9` / `tab_off_9` 16 × 12 (9-slice, 4 px corners), `button_9` / `button_9_sel` 16 × 16 (9-slice, 4 px corners), `cursor` 7 × 7 (points right) | — | 7 |
| Touch (M12, §8.6): `touch_ring`, `touch_fill` (tint) 64 × 64; `touch_jump`, `touch_dash`, `touch_heal`, `touch_interact`, `touch_pause` 24 × 24 (tint); `touch_stick_base` 96 × 96; `touch_knob` 40 × 40; `rotate_phone` 64 × 48 | — | 10 |
| Cosmetic icons (M13, 09 §3, §5): `icon_cos_<CosmeticId>` | 16 × 16 | 59 |

All popups, cards and menus (§6, §7) draw their panel with `panel_9` (plus `panel_9_edge` tinted where a colored border is specified) instead of a flat `panel` rectangle, and their selectable items with `button_9` / `button_9_sel` and the `cursor`. Sizes and positions don't change.

---

## 4. HUD

### 4.1 Layout (640 × 360, 8 px safe margin)
Every layout box (for text: the cap box) stays inside x 8–632, y 8–352; only text outlines may use 1 px of the margin.

| Element | Position | Size | Notes |
|---|---|---|---|
| HUD plates | top (4, 4) 196 × 48 · bottom (4, 280) 128 × 76 | 9-slice | `hud_plate_9` at alpha 0.75 behind the top-left and bottom-left groups, so they read on any background (after playtesting) |
| Heart icon | (8, 9) | 10 × 10 | `hud_heart` |
| HP bar frame | (20, 8) | 160 × 12 | 1 px `ink` border; fill area 158 × 10 at (21, 9). Made bigger after playtesting so HP is easy to see |
| HP text | (184, 10) | — | `87/100` |
| Rush segments 1, 2, 3 | (8, 22), (58, 22), (108, 22) | 48 × 6 each | Fill area 46 × 4 at +1, +1 |
| Player status icons | (184 + slot offset, 22) | 8 × 8 | §4.3 |
| Flask charge icons | (8 + 12i, 30), i < maxCharges | 10 × 12 | |
| Flask fill bar | (8, 46) | 46 × 4 | Fill area 44 × 2 at (9, 47) |
| Coin icon / gold text | (62, 34) / (72, 34) | 8 × 8 | 08's coin trail ends at the coin center (66, 38) |
| Key icon / key count | (104, 33) / (113, 34) | 7 × 10 | |
| Lockpick icon | (122, 33) | 8 × 10 | Only when `lockpickReady` |
| Effect boxes | (8 + 14i, 54) | 12 × 12 | Sub-label centered under each box at y 68 |
| Class name | (8, 285) | — | Line 2 at (8, 296) |
| Slot prompts | centered at box x + 12, y 307 | 11 high | §8.4 |
| Link bar | (box x, 318) | 24 × 2 | §4.9 |
| Weapon 1 / Weapon 2 boxes | (8, 320) / (36, 320) | 24 × 24 | |
| Ability 1 / Ability 2 boxes | (72, 320) / (100, 320) | 24 × 24 | |
| Weapon class icons | (box x + 2 + 8k, 346) | 6 × 6 | |
| Ability level pips | (box x + 2 + 4i, 347), i = 0–4 | 3 × 2 | |
| Run timer | right-aligned at 632, y 8 | `rb_large` | |
| Segment line | right-aligned at 632, y 27 | — | |
| Info line | right-aligned at 632, y 38 | — | |
| Boss bar | §4.12 | | Bottom center |
| Toasts | right-aligned at 632, bottom at 352 | max width 144 | §6.10 |
| Banner | centered at 320, y 80 and 98 | | §6.8 |
| Alert | centered at 320, y 10 and 28 | max width 248 | §6.9 |
| Restart ring | center (320, 156) | 18 × 18 | §4.13 |

### 4.2 HP bar
- Fill width = `hp <= 0 ? 0 : max(1, round(158 × hp / maxHp))`. The bar width never changes with max HP.
- Color `hp`. While `hp ≤ 25%` of max, the fill and the HP text pulse between `hp` and `hpLow` at 2 Hz.
- **Lag:** after a drop, the lost part stays drawn in `text`. 0.40 s after the last drop it shrinks toward the fill at 60% of the bar width per second. A heal sets the lag to the new HP at once and draws the healed part in `good` for 0.25 s.
- HP text `hp/maxHp`; color `bad` while ≤ 25%.
- While a `one_hit` curse is active the frame is `curse` instead of `ink` and pulses at 2 Hz.

### 4.3 Player statuses (02 §5.4)
Fixed order: burning, poisoned, chilled, rooted. Only active ones are drawn, packed left from x 184. Each takes a 10 px slot, except poisoned, which takes 16 px: its icon, then the stack count digit at icon x + 9, y 22.

### 4.4 Rush meter (02 §8)
- Segment k (k = 0, 1, 2) fill width = `floor(46 × clamp(value − 100k, 0, 100) / 100)`, color `rush1/2/3`. A full segment gets a 1 px `text` line on the top row of its fill.
- **Level 3** (value 300): all three fills blink between their color and `text` at 4 Hz.
- While Overdrive's floor (200) is active, a 1 × 6 px `text` tick is drawn at x 108 (the start of segment 3).
- Hidden in villages and the Home Village (02: frozen at 0 there).

### 4.5 Flask (02 §7)
- Charge icon i is `hud_flask_full` if i < charges, else `hud_flask_empty`.
- Fill bar width = `floor(44 × min(fillTenths, 1000) / 1000)`, color `flask`. When fill rises, the newest 1 px column is drawn `text` for 0.2 s. A full banked bar (1000 at max charges) blinks with `text` at 2 Hz.
- A charge gained from fill: that icon flashes `text` for 0.15 s.
- While drinking: the charge being drunk blinks at 8 Hz until the sip point.
- `flask.blocked` (Dry Flask or No Heal): `hud_flask_blocked` is drawn over every icon.
- `healRefused`: all icons are tinted `bad` for 0.15 s.

### 4.6 Gold, keys, Lockpick
- Gold = `floor(goldTenths / 10)`. On `goldChanged`, the number is drawn in `highlight` for 0.15 s.
- Key count: `textDim` at 0, `text` at 1–2, `highlight` at 3 (full).
- Lockpick icon: shown only while the hybrid is Thief and the Lockpick is unused this stage (03 §6.1).

### 4.7 Effects row (Lucky Block and curse, 05 §7–8)
- Order: the curse first, then active debuffs in the order they were first applied (a re-rolled debuff keeps its place), then buffs in the order gained.
- Box: 12 × 12, 1 px border (`curse`, `bad` for debuffs, `good` for buffs), `ink` fill, the 10 × 10 icon at +1, +1.
- Sub-label: debuffs show `ceil(ticksLeft / 120)`; the curse shows `killsLeft`; buffs show nothing. A debuff with ≤ 5 s left blinks at 4 Hz.

### 4.8 Weapon slots
- Box: 1 px `ink` outer border, then a 1 px frame in the **grade color**, then `panel` fill, then the 16 × 16 icon at (box x + 4, box y + 4).
- Empty slot: frame `slotEmpty`, no icon; the prompt is drawn in `textOff`.
- Element icon (if any) at (box x + 15, box y + 2).
- Class icons under the box (1 per class tag; Storm Hammer has 2): tinted with the class color if that class is in `carriedClasses` (03), else `panelBorder`.
- **Storm Hammer** (02 §11): while thrown, icon alpha 0.35. While in hand but not ready: a 2 px bar at (box x + 2, box y + 20), width `floor(20 × elapsed / needed)`, Wizard color. When it becomes ready: frame drawn `text` for 0.1 s.
- **Butterfingers:** slot 2 frame `bad`, icon alpha 0.5, `hud_lock` centered on the icon.
- During the weapon swap choice (§6.2): both frames blink `text` at 4 Hz.

### 4.9 Ability slots
- Box as in §4.8, but the frame uses the ability's **class color** (Vampire: `textDim`).
- **Level pips:** 5 pips under the box (levels 1–5, assumption, see GAME_PLAN 15.3 #3); pip i is `highlight` if i < level, else `slotEmpty`.
- **Cooldown with 0 charges:** an `ink` (alpha 0.7) shade covers the icon from its top, height `ceil(16 × rechargeLeft / cooldownTicks)`, and `ceil(rechargeLeft / rechargeRate / 120)` is centered on the icon (03 §7.7 gives all three values).
- **2-charge abilities** (Blade Dash, Blink at Lv5): the charge count digit at (box x + 17, box y + 14). While a charge recharges and charges ≥ 1: a 2 px bar at (box x + 2, box y + 20), width `floor(20 × (1 − rechargeLeft / cooldownTicks))`, class color.
- A charge coming back: frame drawn `text` for 0.1 s. `abilityUsed`: frame `text` for 0.08 s.
- **Passive** (Vampire): no shade, no prompt.
- **Link** (03 §5.1): while a link window is open and `connection` is true, the **other** slot's frame is `highlight` and its link bar (y 318) has width `round(24 × linkTicksLeft / 360)`. On `abilityLinked`: `LINK ×1.5` in `highlight` rises 12 px over 0.5 s from above that box, then vanishes.
- `abilityNotReady`: frame `bad` for 0.15 s. `abilityFizzle`: frame `textDim` for 0.2 s, plus a label 4 px above the player for 0.8 s: Hunter's Mark → `No target`, Blink → `Blocked`.
- During the ability swap choice (03 §7.1): both frames blink `text` at 4 Hz.

### 4.10 Class name (03 §4.2)
- Line 1: `displayName`, in the class or hybrid color; "No Class" in `textDim`.
- Line 2: with a Connection bonus, `hud_link` at (8, 296) and `bondName` at (18, 296) in `highlight`. With a hybrid: its two classes, e.g. `Swordsman + Archer`, in `textDim`. Otherwise empty.
- On `classChanged`, line 1 is drawn `text` for 0.3 s. On `classDiscovered`, a toast (§6.10).

### 4.11 Timer block
- **Run timer:** `formatTime(runTicks)`, `rb_large`, `text`.
- **Segment line** (`textDim`): in a stage `STAGE n  <formatTime(stageTicks)>`; in a village its short name (§9.4).
- **Info line** (first that applies): a pending timed door within 640 px horizontally (06 §9.5) → `DOOR <formatTime(max(0, timeLimit × 120 − stageTicks))>`, `bad` under 5 s; practice → `PRACTICE`; typed seed → `SEED <seedText>`; else nothing.
- The whole block is hidden when there is no run (Home Village, title). Setting **Show timer = Off** hides the run timer and segment line only; the info line, split alerts and end screens still show times.

### 4.12 Boss bar (04 §9.4)

| Part | Position | Size |
|---|---|---|
| Name (`text`) | (160, 321) | — |
| Title (`textDim`) | right-aligned at 480, y 321 | — |
| HP frame / fill area | (160, 332) / (161, 333) | 320 × 10 / 318 × 8 |
| Poise frame / fill area | (160, 343) / (161, 344) | 320 × 4 / 318 × 2 |
| `BREAK` (`rb_large`, `highlight`) | centered at 320, y 300 | — |

- HP fill = `hp <= 0 ? 0 : max(1, round(318 × hp / maxHp))`, color `hp`, lag as in §4.2.
- **Marks:** 1 px wide `ink` lines over the full fill height at `x = 161 + round(318 × mark)`.
- **Poise:** width `floor(318 × poise / poiseMax)` in `highlight`; during poise immunity (02 §4.3) full width in `textDim`; during Break it is empty, the HP frame blinks `highlight` at 4 Hz, and `BREAK` shows.
- **Shown** when 04's boss start happens (arena locked; Dragon: player enters its arena). During the 1.0 s intro the shown HP grows from 0 to the real value (`hp × t / 1.0`). **Hidden** 1.0 s after `bossDefeated`; at once when the Dragon turns passive (04 §13.3); when it wakes again it shows with no intro. Only one boss bar exists; a newer boss replaces it.

### 4.13 Restart ring (06 §6.2)
While `restartHoldTicks ≥ 12` in a phase where restart is allowed: 16 dots of 2 × 2 px on a circle of radius 8 around (320, 156), dot i at angle `−90° + 22.5° × i` (clockwise from the top), drawn `text` when `restartHoldTicks / 60 ≥ (i + 1) / 16`, else `slotEmpty`. `RESTART` centered at (320, 140). Gone as soon as the counter is 0.

### 4.14 Differences by place
- **Villages:** Rush hidden; effects row empty (05 clears effects on `enterVillage`).
- **Home Village:** timer block hidden; empty slots until a kit is equipped (06 §12.3).
- **Practice:** the run timer shows the practice time (`formatTime(stageTicks)`, 06 §14); the segment line is hidden; info line `PRACTICE`.

### 4.15 HudModel

```ts
type ClassColorKey = ClassId | HybridId | 'neutral' | 'none';
type InteractKind = 'ground_item' | 'loot_stand' | 'merchant_item' | 'merchant_altar' | 'shop_item' | 'ability_altar'
  | 'shop_flask' | 'shop_refill' | 'shop_key' | 'shop_reroll' | 'key_chest' | 'cursed_chest' | 'timed_chest'
  | 'inn' | 'class_statue' | 'unlocks_board' | 'seed_board' | 'minecart'; // 06 §13.4 object types; merchant_altar 06 §11.3
type HintAction = 'move' | 'jump' | 'double_jump' | 'dash' | 'wall_jump' | 'slide' | 'dive_slam' | 'attack'
  | 'lucky_block' | 'ability' | 'heal' | 'interact' | 'drop_through';   // 06 `hint` zone actions
interface WeaponSlotView {
  weaponId: WeaponId; grade: Grade; element: ElementId | null; perk: PerkId | null;
  tags: ClassId[]; litTags: ClassId[];                                 // litTags = tags ∩ carriedClasses
  hammer: { out: boolean; ready: boolean; progress: number } | null;   // Storm Hammer only
  locked: boolean;                                                     // Butterfingers on slot 2
}
interface AbilitySlotView {
  id: AbilityId; level: AbilityLevel; cls: ClassId | null; passive: boolean;
  charges: number; maxCharges: number; rechargeLeft: number; cooldownTicks: number; rechargeRate: number;
  linkTicksLeft: number | null;                                        // set on the slot that glows
}
interface EffectView { kind: 'curse' | 'debuff' | 'buff'; id: LuckyId | CurseId; label: string | null; blink: boolean }
interface BossView {
  name: string; title: string; marks: number[]; hp: number; maxHp: number;
  poise: number; poiseMax: number; poiseImmune: boolean; inBreak: boolean; introT: number | null;
}
interface HudModel {
  hp: number; maxHp: number; oneHitCurse: boolean;
  statuses: { burning: boolean; poisonStacks: 0 | 1 | 2 | 3; chilled: boolean; rooted: boolean };
  rush: { value: number; level: 0 | 1 | 2 | 3; floor: number; visible: boolean };
  flask: { charges: number; maxCharges: number; fillTenths: number; blocked: boolean; drinking: boolean };
  gold: number; keys: number; lockpickReady: boolean;
  weapons: [WeaponSlotView | null, WeaponSlotView | null];
  abilities: [AbilitySlotView | null, AbilitySlotView | null];
  cls: { displayName: string; color: ClassColorKey; bondName: string | null; hybridParts: [ClassId, ClassId] | null };
  effects: EffectView[];                                               // already in §4.7 order
  timer: { visible: boolean; runTicks: number; segmentLabel: string; info: string | null; infoBad: boolean };
  boss: BossView | null;
  restartHoldTicks: number; restartAllowed: boolean;
  swapChoice: 'weapon' | 'ability' | null;
  interactTarget: { id: number; kind: InteractKind } | null;
  charge: { progress: number; full: boolean } | null;                  // charge weapon being held (02 §9.4)
  hint: HintAction | null;                                             // §5.9
  phase: RunPhase;                                                     // 06 §16
}
```

---

## 5. World-anchored UI

### 5.1 Anchors
"N px above X" = centered on X's center x, with the element's **bottom** edge N px above the top of X's hurtbox (or object box).

### 5.2 Damage numbers (setting: Damage numbers)
- **Sources:** each 02 hit event with `amount > 0` on an enemy or the Training Dummy. Player damage and heals come from comparing `hp` with the previous frame: a drop of d → `d` in `bad`; a rise of d → `+d` in `good`. No player number on a frame where `maxHp` changed by the same amount (Vitality) or across a scene change (inn sleep, stage start, restart).
- **Style:** normal hit `rb_small`, `text`. Crit: `rb_large`, `crit`. Secondary damage: `rb_small`, the element's color (§3.3).
- **Spawn:** 2 px above the target, x jitter = integer in [−6, +6] from the UI RNG. If the target no longer exists, use its box from the previous frame; if none, skip.
- **Motion:** life 0.75 s. Rise `round(20 × (1 − (1 − min(age / 0.5, 1))³))` px. Alpha 1 until 0.55 s, then linear to 0 at 0.75 s. Crits start 2 px higher for their first 0.06 s.
- **Merge:** if a live number has the same target and style and is younger than 0.15 s, add the amount to it and set its age to 0 instead of spawning.
- **Cap:** 32 numbers alive; spawning a 33rd removes the oldest.
- Setting Off: no damage numbers at all (enemy, player or heal).

### 5.3 Enemy HP bars (04 `hpBar`)
- `'damaged'` (regular mobs): shown from the first damage until death. `'always'` (elites): shown while the enemy exists. `'boss'`: never (boss bar instead).
- Regular: frame 20 × 4, fill area 18 × 2. Elite: frame 32 × 5, fill area 30 × 3. 3 px above the hurtbox.
- Fill = `max(1, round(fillW × hp / maxHp))` while hp > 0, color `hp`; lag drawn `text`, shrinking after 0.3 s at 100% of the bar width per second.
- Frame color, first that applies: `barrier` (barrier HP > 0), `ward` (warded), `elite`, else `ink`.
- Hidden at once when HP ≤ 0, and while a Living Armor is a pile (shown again when it rises).

### 5.4 Notice marks (04 §2.4)
- While unaware and `noticeT > 0`: `?` (`rb_small`) 2 px above the bar (or 3 px above the hurtbox if no bar). Its color blends from `text` to `#ffa040` by `noticeT / (time × noticeTimeMult)`.
- From the first tick of the alert reaction: `!` (`rb_large`, `bad`) for 0.5 s at the same place. Enemies made aware by a hit skip the alert reaction (04), so they show no `!`.

### 5.5 Charge bar
While the player holds a charge weapon (02 §9.4): frame 18 × 4 (fill area 16 × 2) 4 px above the player. Fill `floor(16 × progress)`, `highlight`; when full the fill blinks `text` at 8 Hz.

### 5.6 Ground item badges
2 px above every ground weapon: a 9 × 9 box in its grade color with the grade letter (`rb_small_plain`, `ink`). Above every ground ability: the same box in its class color with the level digit. Keys, coins and blueprints: none.

### 5.7 Interact prompts
Only the current `interactTarget` gets a prompt or card. A prompt is `[glyph] Verb` (§8.4), `rb_small`, 4 px above the object. Items, shop objects, the inn and statues show a card (§6) instead.

| Target | Text |
|---|---|
| `key_chest` with the Lockpick ready | `Pick lock` |
| `key_chest` with a key | `Open (1 key)` |
| `key_chest` with neither | `Locked` in `textDim`, no glyph |
| `cursed_chest` | `Open` in `curse`; line 2 `Cursed: one-hit death for 10 kills` |
| `timed_chest` | `Open` |
| `unlocks_board` | `Records` (opens §7.5) |
| `seed_board` | `Seed` (opens §6.12); line 2: the active typed seed, if any |
| `minecart` (a cart waiting at its spawn, 01 §13.6) | `Ride` |

- An interact press the core refuses (e.g. weapon pickup while attacking, 02 §9.5) turns the glyph `bad` for 0.15 s.
- **Home Village gate:** while the player overlaps the gate `exit` with no kit, `Choose a class at a statue first` in `bad` is shown 4 px above the player (06 §2.3).

### 5.8 Training Dummy DPS
14 px above the dummy: `DPS n`, n = round(sum of damage in the last 5.0 s ÷ clamp(now − oldest hit in that window, 1.0, 5.0)). Hidden 3.0 s after the last hit.

### 5.9 Stage 1 hints (06 `hint` zones)
While `HudModel.hint` is set (the player is inside a `hint` zone and `progress.stage1Cleared` is false): a panel centered at x 320, top y 52, `panel` fill, 1 px `panelBorder`, 4 px padding, one line of text with glyphs of the **current** bindings (§8.4). Fades in over 0.15 s, out over 0.15 s.

| `action` | Text | `action` | Text |
|---|---|---|---|
| `move` | `[left] [right] Move` | `dive_slam` | `[down] + [attack1] in the air: dive slam` |
| `jump` | `[jump] Jump — hold for higher` | `attack` | `[attack1] [attack2] Attack` |
| `double_jump` | `[jump] in the air: double jump` | `lucky_block` | `Hit Lucky Blocks with a weapon` |
| `dash` | `[dash] Dash — works in the air too` | `ability` | `[ability1] [ability2] Abilities` |
| `wall_jump` | `[jump] on a wall: wall jump` | `heal` | `[heal] Drink the flask` |
| `slide` | `[down] + [dash] on the ground: slide` | `interact` | `[interact] Pick up, open, buy` |
| `drop_through` | `[down] + [jump] Drop through` | | |

---

## 6. Popups

### 6.1 Item card (compare popup)
Shown for a ground item, loot stand, shop item or merchant item while it is the `interactTarget`. Fades in over 0.08 s; gone at once when it stops being the target. The game keeps running.

- **Panel:** `panel` fill, 1 px border in the grade color (weapon) or class color (ability), 4 px padding. Width = clamp(widest row + 8, 160, 260). Bottom 6 px above the item, then clamped inside the 8 px screen margin.
- **Row 1:** icon 16 × 16 at (4, 4); name (05 §4.5) at (24, 4) in the grade or class color; right-aligned badge: grade letter, or `Lv n`.
- **Row 2** at (24, 13), `textDim`: weapon: `Greatsword · Fire · Keen` (type, element word, perk name; missing parts left out). Ability: `Wizard ability`, or `Neutral · always on` for Vampire.
- **Row 3** at (4, 24): weapon: `DMG n`, the class icons (lit as §4.8), and `MATCH` in `good` if matched. Ability: the blurb (§9.2), `textDim`, wrapped to at most 2 lines.
- **Option rows**, then a **bottom row** (table below), each 11 px below the previous row's top. Panel height = last row top + 7 + 4.

**Weapon DMG** = `round(100 × gradeMult × (matched ? 1.25 : 1.0))` (grade multipliers: README; matched: 03 §4.3). All weapons are balanced to the same base DPS (02 §10.1), so this compares grade and match. F unmatched 80, C matched 125, S matched 250.

| Situation | Option rows | Bottom row |
|---|---|---|
| Weapon, a slot is empty | none | `[E] Take` |
| Weapon, both slots full | `[J] <name> <grade>  DMG n  ±d` for slot 1, `[K] …` for slot 2. `±d` = new DMG − that slot's DMG: `good` if > 0, `bad` if < 0, `textDim` `=` if 0. Under Butterfingers slot 2's row is `textOff` with `locked` | `[E] Swap`; while the choice is open: `[E] Cancel` |
| Ability, a slot is empty | `→ <displayName after>` | `[E] Take` |
| Ability, same id carried | `Replaces your Lv n copy` | `[E] Swap` |
| Ability, both slots full | `[U] <ability> Lv n → <displayName after>`, `[I] …` | `[E] Swap` / `[E] Cancel` |
| Key-chest pair item | adds a row `Take 1 of 2` in `textDim` | as above |
| Shop or merchant item | as above | `[E] Buy` + price (§6.4); `Owned` in `bad` for a carried ability |

- `<displayName after>` comes from 03's `computeClassState` on the slots **as they would be** after that choice, in that class or hybrid color, followed by `+ <bondName>` in `highlight` if the bond would be on. If it equals the current `displayName`: `(no change)` in `textDim`.
- Glyphs in rows (`[J]`, `[K]`, `[U]`, `[I]`, `[E]`) are the current bindings (§8.4), not fixed letters.

### 6.2 Weapon swap choice (core rule)
Mirrors 03 §7.1's ability swap choice. Core state: `weaponSwapChoice: { itemId: number } | null`.
1. **Opens** on an interact press on a weapon item (ground, loot stand, shop, merchant) when both weapon slots are filled, the pickup is allowed (not attacking, 02 §9.5), and for bought items the price is affordable. Under Butterfingers an **empty slot 2 counts as filled and locked** (05 §7.3: it can't be filled), so with slot 1 full the choice opens with slot 1 as the only option; the slot-2 row reads `(empty) locked`.
2. **While open:** `attack1.pressed` = replace slot 1, `attack2.pressed` = replace slot 2. These presses never start an attack, a dive or a charge, and are not buffered. Slot 2 is refused (`bad` flash) under Butterfingers. Movement, jump, dash, abilities and the flask work as normal.
3. **On a choice:** 05 §5.7 runs on that tick (old weapon dropped at the feet; bought items are paid now). The choice closes.
4. **Closes without a swap** on: interact pressed again (06 §11.1); the player's box no longer overlapping the item's box; the player taking damage (02 §5.2 step 5); a scene change; the item being gone.
5. Only one swap choice (weapon or ability) can be open at a time.

### 6.3 Ability swap choice
Rules: 03 §7.1 step 4. Drawing: the card's ability option rows with `[U]`/`[I]` glyphs, both ability frames blinking (§4.9).

### 6.4 Shop and price tags (05 §10–12, objects 06 §12.2)
- Every shop object has a **price tag** centered 3 px below its anchor (feet), visible while on screen: `hud_coin` + the price from 05's price function (Haggler and merchant markup included), in `highlight`, or `bad` when unaffordable. States that replace the price, in `textDim`: `SOLD`, `MAX`, `Owned`, `Keys full`, `Full` (refill at max charges). `shop_key` with no key in stock is hidden (06), so it has no tag.
- `shop_item` and merchant items show the item card (§6.1). The others show a small card:

| Object | Card | Press |
|---|---|---|
| `ability_altar` slot n | Line 1 `[E] Upgrade <ability> Lv n → n+1` with the upgrade price (`MAX` at Lv5). Line 2 `Hold [E]: sell for <sell price>`. Empty slot: `No ability` (`textOff`) | **Tap** (release before 0.75 s) = upgrade; **hold 0.75 s** (90 ticks) = sell (06 §12.2). From 0.10 s of holding, a ring of 16 dots (as §4.13, radius 8) around the glyph fills with `holdTicks / 90` |
| `merchant_altar` slot n (06 §11.3) | Line 1 only: `[E] Upgrade <ability> Lv n → n+1` with the normal upgrade price (05 §10). `MAX` at Lv5 (press does nothing). Empty slot: `No ability` (`textOff`), inactive. No sell line, no hold ring | **Press** = upgrade |
| `shop_flask` | `[E] Flask +1 charge` | Press |
| `shop_refill` | `[E] Refill flask` | Press |
| `shop_key` | `[E] Buy a key` | Press |
| `shop_reroll` | `[E] Reroll items` | Press |

- A press that can't buy (05: unaffordable, `MAX`, `Owned`, `Keys full`) does nothing; the tag blinks `bad` at 8 Hz for 0.25 s.

### 6.5 Inn card
Above the inn when targeted: `[E] Sleep`; `Restores all HP (not the flask)` in `textDim` (assumption, see GAME_PLAN 15.3 #5); `Next: Stage n · <biome name>`. In the Crossroads Village the first line is `[E] Choose road and sleep` and the last line is left out (the press opens §6.6, 06 §3). Sleeping itself (fades) is 06's.

### 6.6 Route choice (Crossroads inn, phase `routeChoice`)
The road is the player's choice (assumption, see GAME_PLAN 15.3 #1; flow in 06 §3). World frozen, timer running.
- `dim` over the world. Panel 320 × 150 at (160, 90). `CHOOSE YOUR ROAD` (`rb_large`) centered at y 98.
- Two cards 148 × 100 at (168, 122) and (324, 122), Mountain left, Forest right. Card lines from +6, 11 px apart: `MOUNTAIN ROAD` / `FOREST ROAD` (`highlight` when selected); `Caves & Mountains` / `Dark Forest & Swamps`; `Guardian: Stone Colossus` / `Guardian: Spider Queen`; `More climbing` / `More fighting` (`textDim`); `PB <formatTime>` for `${startClass}|${road}` (06 §5.3) or `PB —`. The selected card has a `highlight` border.
- Cursor starts on `save.lastRoad`. Left/right move it; confirm → 06 sets the road and sleeps; back → cancel (06: back to `village`). Hint at y 228: `←→ Road   [confirm] Sleep   [back] Cancel`.

### 6.7 Class pick (Home Village statue)
Opened by interacting with a `class_statue` (06 §12.3). The world keeps running; the player gets neutral input.
- Panel 220 × 176 at (210, 72). `icon_class_<cls>` centered at y +8; name (`rb_large`, class color) centered at y +28; style line (§9.1) wrapped to 204 px at y +48 (`textDim`); `Ability: <starting ability>` at y +70 and its blurb at y +81 (`textDim`); `Weapon` (`textDim`) at y +100; weapon rows from y +112, 14 px apart: the 2 starting weapons (03 §3), plus the third once unlocked (05 §14.3), each with its blurb right after in `textDim`. The equipped kit's row is marked `(equipped)`.
- Up/down: weapon (starts on the equipped weapon if this class is equipped, else the first). Confirm → 06 equips the kit at once and the popup closes. Back → close, nothing changes. Hint at y +160: `↑↓ Weapon   [confirm] Equip   [back] Close`.

### 6.8 Banners (center, y 80 and 98)
One at a time; a new banner **replaces** the current one at once. In: 0.1 s (alpha 0 → 1 while moving down 6 px to its place). Out: alpha to 0 over the last 0.3 s.

| Trigger | Line 1 (`rb_large`) | Line 2 (`rb_small`) | Time |
|---|---|---|---|
| `stageStarted` | `STAGE n` | biome name upper case (`textDim`) | 2.0 s |
| `enterVillage` (not Home) | village name upper case | `Shop, then sleep at the inn` (`textDim`) | 2.0 s |
| `luckyResult` buff | name upper case, `good` | §9.3 | 1.6 s |
| `luckyResult` debuff | name upper case, `bad` | §9.3 | 1.6 s |
| `luckyResult` jackpot | `JACKPOT!`, grade S color | §9.3 | 1.6 s |
| `curseApplied` | `CURSED`, `curse` | §9.3 | 2.0 s |
| `curseLifted` | `CURSE LIFTED`, `good` | — | 1.2 s |

### 6.9 Alerts (top center, y 10 and 28)
First-in-first-out queue, one shown at a time, same in/out animation as banners.

| Trigger | Line 1 (`rb_large`) | Line 2 (`rb_small`) | Time |
|---|---|---|---|
| `split {index, runTicks, deltaTicks, bestSegment}` | `STAGE n CLEAR` | `formatTime(runTicks)`; then `formatDelta(deltaTicks)` (`good` < 0, `bad` > 0, `text` = 0; left out if null); then `★ BEST SEGMENT` in `highlight` if `bestSegment` | 3.0 s |
| `dragonWarning {color}` | `A DRAGON APPROACHES` in the Dragon color | `<Color> Dragon · optional fight · great loot` | 3.0 s |

**Dragon edge arrow** (the Dragon is optional and in a side arena: assumption, see GAME_PLAN 15.3 #2): after `dragonWarning`, while the Dragon is alive and not engaged, the player is not in its arena, and the arena center is off-screen horizontally and within 1600 px of the player: `hud_dragon_arrow` at x 620 (mirrored at x 8 for the left side), y = clamp(arena center screen y − 6, 60, 290), blinking at 1 Hz.

### 6.10 Toasts (bottom right)
Right-aligned at x 632, newest at the bottom (bottom edge y 352), older ones pushed up, 2 px apart; max width 144 (wrap, max 2 lines); max 4 shown (a 5th removes the oldest). Fade out over the last 0.3 s.

| Event | Text | Color | Time |
|---|---|---|---|
| `keysFull` | `Keys full (3)` | `textDim` | 2.0 s |
| `lockpickUsed` | `Lockpick used` | `text` | 2.0 s |
| `blueprintFound` | `Blueprint: <item name>` / `Unlocked next run` | `highlight` | 3.0 s |
| `classDiscovered` | `New class discovered: <bond or hybrid name>` | `highlight` | 3.0 s |
| `purchase` | `−<price>` | `textDim` | 1.5 s |
| `saveFailed` (first time per session only) | `Can't save — progress won't be kept` | `bad` | 5.0 s |

### 6.11 Stat upgrade pick (phase `statPick`, 05 §13)
- Opens when 06 enters `statPick` (1.0 s after a stage boss dies, 06 §2.5). World frozen, timer running, restart hold still works.
- `dim` over the world (not the HUD). `CHOOSE AN UPGRADE` (`rb_large`) centered at y 72.
- 3 cards, 116 × 120, at x 134, 262, 390, y 110, in 05's draw order. Card: `panel`, 1 px `panelBorder` border; icon 16 × 16 centered at y +8; name centered at y +30; 05's `text` wrapped to 104 px at y +44 (`textDim`); `Have n/max` at y +106 if n > 0.
- The highlighted card has a `highlight` border and is drawn 4 px higher. It starts on the **middle** card.
- Left/right move the highlight (no wrap); confirm picks it. Confirms during the first **0.30 s** after opening are ignored. It can't be closed without picking. Pause still works on top.
- On pick: 05 applies it that tick; 06 returns to `stage`; input swallow applies.

### 6.12 Seed entry (Home Village `seed_board`)
Seed rules are 06 §7.1 (1–12 characters, `A–Z` `0–9`). The world keeps running; the player gets neutral input.
- Panel 240 × 110 at (200, 110). `SEED` (`rb_large`) at y +6. 12 boxes 14 × 18, 2 px apart, centered, at y +30; the cursor box has a `highlight` border.
- Keyboard: a letter (lowercase is upper-cased) or digit fills the cursor box and moves right; Backspace clears the box to the left and moves there; other characters are ignored. Up/down on a box cycle it: blank → A…Z → 0…9 → blank. Left/right move the cursor.
- Items under the boxes (y +60, 16 px apart, left to right): `Use` (disabled while empty; sets the typed seed, 06), `Random` (fills 8 characters with 06's random-seed rule: `crypto.getRandomValues`, charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), `Clear` (removes the typed seed), `Back`.
- Characters after the first blank box are ignored; `Use` takes the boxes up to the first blank.

---

## 7. Screens (menus)

### 7.1 Menu input
Menus and the popups in §6.6, §6.7, §6.11, §6.12 read devices directly, not `InputState`.

| Action | Keyboard | Gamepad |
|---|---|---|
| Move cursor | Arrows, W/A/S/D | D-pad, left stick (\|axis\| ≥ 0.5) |
| Confirm | Enter, Space, and the keys bound to Jump and Interact | A (button 0) |
| Back | Escape, Backspace | B (button 1) |
| Clear binding (controls screen) | Delete, Backspace | X (button 2) |

- Hold to repeat: first repeat after 0.35 s, then every 0.10 s. Browser key-repeat events are ignored.
- If a bound key is also a fixed menu key (e.g. Jump rebound to Backspace), the fixed menu meaning wins inside menus.
- **Seed entry exception:** letter and digit keys only type, Backspace only deletes, navigation uses the arrows only, confirm is Enter only, back is Escape only (pad buttons as usual).
- In hint lines, `[confirm]` and `[back]` are glyphs (§8.4): `ENT` / `ESC` on keyboard, A / B (✕ / ○) on a pad.
- Mouse: hovering a menu item selects it; left click confirms it. The mouse does nothing in gameplay; the cursor hides after 2.0 s without movement.
- Lists do not wrap. The selected item is drawn in `highlight` with `▸` 8 px to its left; disabled items are `textOff` and are skipped.
- Menu screens switch instantly. Fades into and out of gameplay are 06 §2.2's; title → Home Village uses 0.25 s out and 0.25 s in.
- The browser default action is prevented for every bound key and for Space, the arrows and Tab while the game has focus.

### 7.2 Boot
`Loading n%` centered at y 170; bar frame 160 × 6 at (240, 184).

### 7.3 Title
- **Step 1:** `RUSHBLADE` (`rb_large` × 2, grade S color) centered at y 70; `Press any button` blinking at 1 Hz at y 220. Any key, click or pad button goes to step 2. A key press or click is also the browser audio unlock gesture; a pad button is not (08 §15).
- **Step 2:** items centered, 16 px apart from y 170: `Play` (→ Home Village, 06), `Practice` (§7.4), `Records` (§7.5), `Settings` (§7.7). Version string right-aligned at (632, 344), `textOff`.
- **Sound prompt:** while `sound.locked` is true (Phaser's sound manager), step 2 also shows `Press a key or click to enable sound` (`textDim`) centered at y 316. It disappears on the first frame `sound.locked` is false. (y 316 keeps it clear of the newer-version warning at y 300.)
- If 06 loaded a save from a newer version, `Save is from a newer version — progress won't be saved` in `bad` centered at y 300.

### 7.4 Practice setup and result (06 §14)
- Rows from y 80, 16 px apart, labels at x 160, values right-aligned at x 480; left/right change values:
  - `Stage`: the levels in `levelsReached` (`plains` always), shown as `1 · Plains & Forest`, `2 · Caves & Mountains`, `2 · Dark Forest & Swamps`, `3 · Enemy Kingdom`, `4 · King's Castle`.
  - `Class`: 4 classes. `Weapon`: that class's starting weapons (2, or 3 if unlocked).
  - `Dragon` (Stages 2–3 only, else `textOff` `—`): `Off`, `Random color`, `Red`, `White`, `Storm`, `Green`. Default `Off`.
  - `Seed` (read-only): the typed seed, or `Random`.
  - `Best`: `practiceBests[levelId|class]` or `—`.
  - `Start`, `Back`.
- **Result screen** (on the boss's death in practice): `STAGE CLEAR` (`rb_large`) centered at y 100, time (`rb_large`) at y 124, then `★ NEW BEST` (`highlight`) or `Best <formatTime>` at y 150. Items: `Retry`, `Change setup`, `Title`. Confirms ignored for 0.5 s.

### 7.5 Records (title, or the Home Village `unlocks_board`)
Three tabs switched with left/right (names at y 24: `BEST RUNS`, `CLASSES`, `UNLOCKS`; current tab `highlight`).
- **Best runs:** rows = 4 starting classes, columns = Mountain road, Forest road; each cell is `pbs[class|road].ticks` or `—`. Under the table, for the selected cell: its 4 best segments (06 `bestSegments`).
- **Classes:** 4 bonds and 6 hybrids in a grid (5 per row, 112 × 40 each); discovered ones show the name in their color, others `???` in `textOff`.
- **Unlocks:** the 9 blueprint items (05 §14.1) with icon; locked ones drawn as a silhouette (icon tinted `ink`) and `???`. Then the third starting weapon per class: its name, or `Beat the King as <class>`.

### 7.6 Pause (phase `paused`)
- Opens on the pause button in `homeVillage`, `stage`, `statPick`, `village`, `routeChoice`, or by 06's auto-pause (focus loss, hidden tab). `dim` over everything below.
- Panel 200 × 150 at (220, 105). `PAUSED` (`rb_large`) at y +8. Info line at y +30 (`textDim`): `Stage n · <formatTime(runTicks)>` plus `· SEED <seedText>`.
- Items: in a run `Resume`, `Restart run`, `Settings`, `Quit to Home Village`; in the Home Village `Resume`, `Settings`, `Quit to title`; in practice `Resume`, `Retry`, `Change setup`, `Settings`, `Quit to title`.
- `Restart run`/`Retry`: 06's restart at once. A quit item needs a second confirm within 2.0 s: the first confirm changes its text to `Quit? Confirm again` in `bad`; otherwise it reverts.
- Pause button or Back: resume (input swallow applies).
- If the active gamepad disconnected (which also pauses), `Controller disconnected` in `bad` shows under the title.
- **Tabs** (added so players can read their build): the panel grows to 360 × 220 at (140, 70) with 3 tabs at its top (`tab_on_9` / `tab_off_9`), switched with left/right: `MENU` (the items above), `LOADOUT`, `CONTROLS`. It opens on `MENU`.
  - **`LOADOUT`:** one row per weapon slot and ability slot: icon, name, grade or `Lv n`, and the item card's row 2–3 text (§6.1), with matched class icons lit. Under them the class block: `displayName` in its color and one line explaining it: no class `Carry a class ability to get a class`; one class `Add a 2nd <class> ability for <bondName>`; Connection `<bondName>: <bond blurb>` plus `Use both abilities within 3 s for +50%`; hybrid `<hybrid name>: <perk blurb>` (blurbs §9.2).
  - **`CONTROLS`:** a read-only list of every action and its current binding (§8), 2 columns.

### 7.7 Settings
Labels at x 160, values right-aligned at x 480, rows 16 px apart from y 56. Left/right change values; every change applies and is saved at once (06 §15.1 stores `SettingsData`, §8.5).

| Row | Values | Default |
|---|---|---|
| Controls ▸ | opens §7.8 | — |
| Master volume | 0–100, step 10, drawn as 10 cells of 6 × 6 + number | 80 |
| Music volume | same | 70 |
| SFX volume | same (each change plays 08's UI tick sound) | 80 |
| Show timer | On / Off | On |
| Screen shake | On / Off (Off: 01 §14.4 offset is always 0) | On |
| Damage numbers | On / Off | On |
| Button icons | Auto / Keyboard / Xbox / PlayStation | Auto |
| Fullscreen | confirm toggles browser fullscreen (not saved) | — |
| Export save ▸ | §7.9 | — |
| Import save ▸ | §7.9 | — |
| Back | — | — |

08 converts the volume values to gains.

### 7.8 Controls (rebinding)
- Columns: action name at x 40, `Key 1` at x 240, `Key 2` at x 340, `Gamepad` at x 460. 14 action rows (§8.1), 16 px apart from y 56; then `Reset to defaults`, `Back`. Up/down move rows, left/right move columns.
- Fixed cells (not selectable, `textDim`): gamepad Left/Right/Up/Down (`D-pad / L-stick`), Pause Key 1 (`Esc`), Pause gamepad (`Start`).
- Confirm on a cell → it blinks `Press a key…` (keyboard columns) or `Press a button…` (gamepad column) and captures the next press of that device. Escape (keyboard) or Start (pad) cancels; 5.0 s without a press cancels.
- Clear (Delete/Backspace, pad X) empties a keyboard cell. The rules in §8.3 apply; a refused change flashes the cell `bad` for 0.3 s.
- `Reset to defaults` restores §8.1 for both devices.

### 7.9 Export and import (06 §15.3)
- **Export:** a panel 560 × 200 at (40, 80) with a DOM `<textarea readonly>` laid over it (scaled with the canvas, monospace) holding 06's export code, all selected. Items under it: `Copy` (`navigator.clipboard.writeText`; toast `Copied`) and `Back`.
- **Import:** the same panel with an empty, focused DOM `<textarea>`. Items: `Import`, `Back`. `Import` runs 06's import check: on failure `That code isn't valid` in `bad` under the box; on success the items change to `Replace your save? This can't be undone` with `Confirm` / `Cancel`. Confirm → 06 applies it and settings take effect at once.
- While a textarea has focus, game key handling is off, except Escape (= Back). The DOM element is removed when the panel closes.

### 7.10 Death screen (phase `dead`)
- Opens when 06 says so (1.0 s after the death tick). `dim` over the frozen world. Death restarts the whole run (assumption A2, GAME_PLAN 0).
- `YOU DIED` (`rb_large`, `bad`) centered at y 100. Lines centered, 12 px apart from y 126 (`textDim`): `Stage n · <biome name> · Section s of 8`; `<formatTime(runTicks)>`; the cause line; `Seed <seedText>`.
- Cause line from `playerDied {cause}`: an enemy id → `Killed by <enemy name>` (§9.4); `hazard` → `Killed by a trap`; `spikes` → `Killed by spikes`; `burning` → `Burned`; `poisoned` → `Poisoned`.
- Items centered from y 200: `Restart`, `Change class`, `Title` (06 §6.1). Cursor on `Restart`. Confirms during the first 0.25 s after the screen opens are ignored. A fresh `restart` press also restarts (06 §6.1 step 4).
- **Practice:** no death screen; 06 §14 restarts the same practice setup.

### 7.11 Run summary (phase `runComplete`)
- Opens when 06 says so (after the King's death animation). Inputs ignored for the first 1.0 s.
- `VICTORY` (`rb_large`, grade S color) centered at y 16. Final time (`rb_large`) at y 40. Line at y 62: `★ NEW PERSONAL BEST` (`highlight`) if `pbSaved` fired; else `formatDelta` vs the PB (`good`/`bad`); typed-seed runs: `Seeded run — records not saved` (`textDim`).
- Splits table from y 86, 14 px rows: stage and biome (x 120), segment time (x 360, right-aligned), run time at that split (x 440, right-aligned), delta vs the comparison run (x 520, right-aligned, `good`/`bad`, `—` with none), `★` in `highlight` at x 528 for a best segment.
- Info from y 160, 12 px apart: `Class: <start class> → <final displayName>`; `Road: Mountain` / `Forest`; `Seed: <seedText>`; `Kills: n (elites m)`; `Gold earned: n`; `Chests: n · Lucky Blocks: n · Flasks drunk: n`; `Damage taken: n`; `Dragon: Not this run / Skipped / Escaped / Slain` (06 outcome `absent` / `skipped` / `escaped` / `killed`).
- Unlocks from y 262 (`highlight`): blueprints collected this run, the win's bonus blueprint (05 §14.2), a new starting weapon (05 §14.3), classes discovered this run.
- Items in a row at y 330, centered at x 220, 320, 420: `Restart`, `Home Village`, `Title` (06 §2.1); left/right move between them, the cursor starts on `Restart`.

---

## 8. Controls

### 8.1 Actions and defaults (plan section 11)
Keys are stored as `KeyboardEvent.code`; pad buttons as Standard Gamepad indices.

| `ActionId` | `InputState` (01) | Key 1 | Key 2 | Gamepad |
|---|---|---|---|---|
| `left` | `moveX = −1` | `KeyA` | `ArrowLeft` | D-pad left (14) + left stick (fixed) |
| `right` | `moveX = +1` | `KeyD` | `ArrowRight` | D-pad right (15) + left stick (fixed) |
| `up` | `moveY = −1` | `KeyW` | `ArrowUp` | D-pad up (12) + left stick (fixed) |
| `down` | `moveY = +1` | `KeyS` | `ArrowDown` | D-pad down (13) + left stick (fixed) |
| `jump` | `jump` | `Space` | — | 0 (A) |
| `dash` | `dash` | `ShiftLeft` | — | 5 (RB) |
| `attack1` | `attack1` | `KeyJ` | — | 2 (X) |
| `attack2` | `attack2` | `KeyK` | — | 3 (Y) |
| `ability1` | `ability1` | `KeyU` | — | 6 (LT) |
| `ability2` | `ability2` | `KeyI` | — | 7 (RT) |
| `heal` | `heal` | `KeyQ` | — | 4 (LB) |
| `interact` | `interact` | `KeyE` | — | 1 (B) |
| `restart` (hold) | `restart` | `KeyR` | — | 8 (Select / View) |
| `pause` | `pause` | `Escape` (fixed) | `KeyP` | 9 (Start, fixed) |

Up is used for the Storm Hammer throw (02 §11); down for slide, dive slam and drop-through (01). All other bindings are rebindable (§8.3).

### 8.2 Reading devices
- **Keyboard:** event-driven (`keydown`/`keyup`, ignoring `repeat`). A button is held if any of its keys is down. 01 §1.2 does the latching and merges devices.
- **Gamepad:** poll `navigator.getGamepads()` once per rendered frame. Use the first connected pad with `mapping === 'standard'`, else the first connected pad (same indices). Buttons 6 and 7 count as held when `value ≥ 0.5`; others use `pressed`. The stick goes through 01 §1.2's thresholds.
- **Last device** (for prompts): keyboard after any `keydown`; gamepad after any pad button press or any stick axis with \|value\| ≥ 0.5.
- The active pad disconnecting during gameplay opens the pause menu (§7.6).

### 8.3 Rebinding rules (`src/ui/model/bindings.ts`, pure)
1. Each action has 2 keyboard cells and 1 gamepad cell. A key code or a pad button can be in **only one cell** in total.
2. **Not capturable:** keys `Escape`, `Tab`, `MetaLeft`, `MetaRight`, `ContextMenu`, `PrintScreen`, `F1`–`F12`; pad buttons 9 (Start) and 12–15 (D-pad). A press of one of these while capturing is ignored (except the cancel keys, §7.8).
3. **Conflict = swap:** if the captured key is already in another cell, that cell gets the edited cell's old value (which may be empty). Binding a key to the other cell of the same action moves it (the old cell becomes empty).
4. **Validation after every change:** every action must keep **at least one keyboard key**. A change or clear that breaks this is refused entirely.
5. Gamepad cells always hold a button; there is no clear. Conflicts swap the two actions' buttons.
6. Bindings take effect at once, also in menus (confirm uses the bound Jump/Interact keys).

### 8.4 Prompt glyphs and labels
- **Style:** the `Button icons` setting; `Auto` = keyboard if the last device is the keyboard, else PlayStation if the pad's `id` matches `/054c|dualshock|dualsense|playstation/i`, else Xbox.
- A glyph is drawn by code, 11 px tall. Keyboard: a 1 px `text` border around `panel`, square corners, the label in `rb_small_plain` centered, width = label width + 4 (min 11). Xbox face buttons (0–3): an 11 × 11 circle filled A `#3fbf4f`, B `#e0463c`, X `#3c8ce0`, Y `#f0c030`, letter in `ink`. PlayStation face buttons: an 11 × 11 `panel` circle with the `prompt_ps_*` symbol tinted cross `#7aa8ff`, circle `#ff6a6a`, square `#ff8ad8`, triangle `#4fd6a0`. Other pad buttons: a rounded box with a label.
- Each glyph shows the action's **first non-empty** binding for the shown device.

| Pad index | Xbox label | PlayStation label |
|---|---|---|
| 0 / 1 / 2 / 3 | A / B / X / Y | ✕ / ○ / □ / △ (atlas symbols) |
| 4 / 5 / 6 / 7 | LB / RB / LT / RT | L1 / R1 / L2 / R2 |
| 8 / 9 / 10 / 11 | SEL / STA / L3 / R3 | SHR / OPT / L3 / R3 |
| 12–15 (hints) | ↑ / ↓ / ← / → | ↑ / ↓ / ← / → |

- **Key labels (max 3 characters):** `KeyX` → `X`; `DigitN` → `N`; `NumpadN` → `N` + digit (e.g. `N5`); arrows → `←` `→` `↑` `↓`; `Space` `SPC`; `ShiftLeft` `SHF`; `ShiftRight` `RSH`; `ControlLeft` `CTL`; `ControlRight` `RCT`; `AltLeft` `ALT`; `AltRight` `RAL`; `Enter` `ENT`; `Backspace` `BSP`; `CapsLock` `CAP`; `Escape` `ESC`; `Delete` `DEL`; `Insert` `INS`; `Home` `HOM`; `End` `END`; `PageUp` `PGU`; `PageDown` `PGD`; punctuation codes → their character (`Comma` `,`, `Period` `.`, `Slash` `/`, `Semicolon` `;`, `Quote` `'`, `BracketLeft` `[`, `BracketRight` `]`, `Backslash` `\`, `Minus` `-`, `Equal` `=`, `Backquote` `` ` ``); anything else → the first 3 characters of the code, upper case.
- If `navigator.keyboard.getLayoutMap()` exists, letter, digit and punctuation keys show the layout's character (upper case) instead, so AZERTY players see `Q` for `KeyA`.
- The controls screen uses long labels: the same, except `Space`, `Left Shift`, `Right Shift`, `Left Ctrl`, `Right Ctrl`, `Left Alt`, `Right Alt`, `Enter`, `Backspace`, `Left Arrow` (etc.).

### 8.5 Settings data
06 stores this object as `save.settings` and owns storage, export and import.

```ts
type ActionId = 'left' | 'right' | 'up' | 'down' | 'jump' | 'dash' | 'attack1' | 'attack2'
  | 'ability1' | 'ability2' | 'heal' | 'interact' | 'restart' | 'pause';
interface Bindings {
  keyboard: Record<ActionId, [string | null, string | null]>;  // KeyboardEvent.code; pause[0] is always 'Escape'
  gamepad: Record<ActionId, number | null>;   // left/right/up/down: null (D-pad + stick are fixed); pause: always 9
}
interface SettingsData {
  volume: { master: number; music: number; sfx: number };     // 0–100, multiples of 10
  showTimer: boolean; screenShake: boolean; damageNumbers: boolean;
  promptStyle: 'auto' | 'keyboard' | 'xbox' | 'playstation' | 'touch';
  bindings: Bindings;
  touch: { mode: 'auto' | 'on' | 'off'; opacity: number /* 20–100 */; size: number /* 80–130 */;
           leftHanded: boolean; vibration: boolean;
           layout: Partial<Record<TouchControlId, { x: number; y: number; scale: number }>> };  // §8.6, M12
  effects: 'high' | 'low';    // 'low' default on touch devices: half the particles, darkness at half resolution
}
type TouchControlId = 'stick' | 'jump' | 'attack1' | 'dash' | 'attack2' | 'ability1' | 'ability2' | 'heal'
  | 'interact' | 'pause';
```
On load, any missing or invalid field takes its default (§7.7, §8.1); a `bindings` object that fails §8.3 validation resets to the defaults as a whole.


### 8.6 Touch controls (phones and tablets, M12)
Phones play in **landscape**. Touch controls are an **HTML overlay above the game canvas** (`src/ui/touch/`, plain DOM, no Phaser), sized in CSS pixels so they stay finger-sized whatever the game's scale. They feed the same per-tick input latch as the keyboard and gamepad (01 §1.2), as a third device `touch`.

**Unit:** `u = clamp(min(innerWidth, innerHeight) / 7.5, 40, 72)` CSS px, times the **Button size** setting (80–130%). On a typical phone in landscape (390 px tall) `u = 52`.

**Left side: floating stick.** A touch that starts in the left 45% of the screen (and not on another control) puts the stick's center there. Dragging moves the knob up to `r = 1.1u` from the center:
- `moveX = −1/+1` when the horizontal offset is beyond `0.35r`; `moveY = −1` (up) when the offset is more than `0.5r` upward, `+1` (down) when more than `0.5r` downward. So 8 directions, like the D-pad.
- Lifting the finger releases everything. The stick fades to 30% when untouched and is drawn only while held (plus a faint hint circle at `(1.6u, innerHeight − 1.6u)`).

**Right side: buttons** (circles, distance from the bottom-right corner, `d` = diameter):

| Control | Action (§8.1) | Size `d` | Center (right, bottom) | Icon |
|---|---|---|---|---|
| Jump | `jump` | 1.45u | (1.0u, 1.0u) | up arrow |
| Attack 1 | `attack1` | 1.25u | (2.55u, 0.85u) | weapon slot 1 icon (07 §4.8), grade-colored ring |
| Dash | `dash` | 1.05u | (1.1u, 2.5u) | dash streak |
| Attack 2 | `attack2` | 1.05u | (2.6u, 2.3u) | weapon slot 2 icon (dimmed if empty) |
| Ability 1 | `ability1` | 0.95u | (3.95u, 1.25u) | ability icon + cooldown shade like 07 §4.9 |
| Ability 2 | `ability2` | 0.95u | (3.85u, 2.6u) | ability icon + cooldown shade |
| Heal | `heal` | 0.85u | (2.35u, 3.6u) | flask with the charge count |
| Interact | `interact` | 1.0u | (5.2u, 1.2u) | hand; shown **only** while there is an interact target (07 §5.7), with its prompt word above (`Open`, `Take`, `Buy`…) |
| Pause | `pause` (tap) / `restart` (hold) | 0.75u | top-right (0.7u, 0.7u from the top) | two bars |

- **Pressing:** a touch that starts on a button sets that action held until the finger lifts; the press counts on the tick it started (01 latching, so a tap shorter than a tick still registers). A finger that slides off a button keeps holding it (no accidental releases); sliding onto another button does nothing. Any number of fingers at once.
- **Hit area** = the circle grown by 0.15u; where two overlap, the nearest center wins.
- **Pause / restart:** tapping Pause (released before 0.5 s) opens the pause menu. **Holding** it for 0.5 s is the instant restart (06 §6.2), with the 07 §4.13 ring drawn around the button.
- **Swap choices** (07 §6.2–6.3) keep working: Attack 1/2 and Ability 1/2 are the slot choices; the item card's option rows can also be tapped.
- **Menus and popups:** tapping a row selects and confirms it; every menu gets a back arrow (top-left, 0.75u) that does what Back does. Sliders and toggles in settings respond to taps and drags.
- **Look:** buttons are `panel` circles with a 2 px `text` ring at the **Touch opacity** setting (20–100%, default 55%); a pressed button is drawn at 100% with a `highlight` ring. Cooldown shades and charge counts mirror the HUD (07 §4.9). Art from 08 / ART10 (`touch_*` frames); until then simple shapes.
- **Prompt style `touch`:** while the last device is touch, prompt glyphs (§8.4) draw the matching button's icon in a small circle instead of a key.
- **When shown:** setting **Touch controls** `Auto` (default; shown after the first touch, hidden again after a key or pad press), `On`, `Off`.
- **Left-handed:** mirrors the layout (stick on the right, buttons on the left).
- **Edit layout** (settings): drag any button to a new place, pinch to resize it (60–150%); `Reset` restores the table above. Saved per device in `settings.touch.layout` (positions as fractions of the screen so rotation and other phones still work).
- **Vibration** setting (default on where supported): `navigator.vibrate(12)` when the player is hit, 25 on death, 8 on a parry. Never during menus.
- **Portrait:** when the screen is taller than wide, the game pauses and shows "Turn your phone sideways" with a rotating-phone drawing.

**Phone screen scaling:** 00-README's whole-number scaling gives 1× on most phones (390 / 360). On touch devices, and whenever the whole-number scale would be below 2, the game instead **fits the screen with a fractional scale** (nearest-neighbor, `pixelArt` stays on), centered, with the leftover bars in `ink`. Above 2× on desktop nothing changes.

---

## 9. Text tables (`strings.ts`)

### 9.1 Class style lines
Swordsman `Blades, fast combos, precise` · Tank `Heavy hitter. Slow, huge hits, tanky` · Archer `Ranged and mobile` · Wizard `Storm magic, Thor-style`.

### 9.2 Blurbs (cards, class pick)

| Ability | Blurb | Weapon | Blurb |
|---|---|---|---|
| Blade Dash | Extra dash that slices through enemies | Greatsword | 3rd hit is a huge cleave |
| Whirlwind | Spin forward through enemies | Katana | Hold: dash-slash through enemies |
| Blade Flurry | Swords spin around you | Twin Daggers | Crits from behind |
| Riposte | Block a hit, counter with a big slash | Spear | Attack while dashing to lunge |
| Shockwave | Ground slam that knocks enemies up | Scythe | Kills fill the flask more |
| Shoulder Charge | Charge forward. Breaks cracked walls | War Maul | Dive slam makes a shockwave |
| Rage | More damage, can't be staggered | Iron Fists | Finisher uppercut launches you |
| Boulder Toss | Rip up a boulder and throw it | Giant Axe | Spin attack while moving |
| Arrow Rain | Rain arrows on the area ahead | Flail | Hold: huge hit that pulls enemies |
| Turret | Drop a ballista that shoots for you | Shield | Block. Perfect parry stuns |
| Grapple Arrow | Pull yourself to walls, or enemies to you | Bow | Hold: charged shot pierces |
| Hunter's Mark | Marked enemies take extra damage | Crossbow | Bolts pin enemies to walls |
| Thunder Strike | Call lightning on enemies ahead | Hand Cannon | Knocks you backward |
| Frost Burst | Freeze enemies around you | Javelin | Sticks in walls. Stand on it |
| Blink | Teleport a short way, even through thin walls | Throwing Knives | Throws 3 at once |
| Time Slow | Slow everything except you | Storm Hammer | Up + attack: throw it, it comes back |
| Vampire | Always on: kills fill the flask more | Staff | Hold: big exploding orb |
| | | Wand | Shots home in a little |
| | | Spell Tome | Ring of spinning runes |

**Bonds and hybrids** (pause `LOADOUT` tab; numbers are 03's):

| Bond / hybrid | Blurb |
|---|---|
| Blademaster | Every 3rd hit crits. Kills reset your dash |
| Iron Will | +30% max HP. No knockback while attacking |
| Eagle Eye | Long shots always crit. Fall slowly while aiming |
| Storm Caller | Abilities recharge 25% faster. Stronger elements |
| Thief | Faster and sneakier. Sneak hits crit. Open 1 chest free per stage |
| Gladiator | Switching weapons keeps your combo and hits harder |
| Spellblade | Melee hits shorten ability cooldowns |
| Warden | Melee hits power up your next shot, and shots power up your next melee hit |
| Thunderlord | Heavy hits call lightning |
| Arcane Archer | Arrows carry lightning. Charged shots explode |

### 9.3 Lucky Block and curse lines (values are 05's; update the text if 05 changes)

| id | Line 2 | id | Line 2 |
|---|---|---|---|
| swift | +25% move speed this stage | heavy | −20% move speed for 45 s |
| golden_touch | Double gold from enemies this stage | glass_bones | Take double damage for 45 s |
| firestarter | All your hits burn this stage | leaky_pockets | Drop gold when hit for 45 s |
| second_wind | Revive once with half HP this stage | ambush | Enemies all around you! |
| overdrive | Rush can't drop below level 2 this stage | jammed | Dash cooldown doubled for 45 s |
| bloodrush | Kills fill the flask double this stage | dry_flask | Can't drink the flask for 45 s |
| jackpot | A rare weapon drops! | butterfingers | Weapon 2 locked for 45 s |

Curses: `one_hit` `You die in one hit until 10 kills` · `no_heal` `Can't drink the flask until 10 kills` · `heavy_feet` `No double jump until 10 kills` · `hunted` `Enemies are faster until 10 kills`.

### 9.4 Place and enemy names
- Stages (06 ids): `plains` Plains & Forest · `mountains` Caves & Mountains · `swamps` Dark Forest & Swamps · `kingdom` Enemy Kingdom · `castle` King's Castle.
- Villages (long / short): `home` Home Village / HOME · `crossroads` Crossroads Village / CROSSROADS · `border` Border Village / BORDER · `rebel_camp` Rebel Camp / REBEL CAMP.
- Enemy display name = the 04 `EnemyId` with `_` → space and each word capitalized (`bandit_archer` → `Bandit Archer`), except `wisp` → `Will-o'-Wisp`; bosses use 04's bar `name`.

---

## Test checklist

Unit tests (Vitest) on `src/ui/model/` and `src/core/` unless marked e2e.

1. HP fill width: 50/100 → 79 px; 1/208 → 1 px; 0/100 → 0 px; 100/100 → 158 px.
2. Rush fills: value 150 → [38, 19, 0]; 299 → [38, 38, 37]; 300 → [38, 38, 38] with the level-3 blink on.
3. Flask fill: 500 tenths → 22 px; 999 → 43 px; 1000 → 44 px.
4. Ability shade: `rechargeLeft` 480 of `cooldownTicks` 960 → 8 px; with `rechargeRate` 1.25 the label is `4`.
5. Debuff sub-label: 5400 ticks → `45`; 1 tick → `1`. The effects list orders curse, then debuffs by first application, then buffs.
6. Boss marks for the Enemy King (`[0.66, 0.33]`) are drawn at x 371 and 266.
7. An enemy with `hpBar: 'damaged'` has no bar before damage and one after; `'always'` has one at spawn; `'boss'` never has a world bar.
8. Weapon DMG: S matched = 250, C matched = 125, F unmatched = 80; a card comparing a matched B (156) to a slot holding a matched C (125) shows `+31` in `good`.
9. With both weapon slots full, interact on a weapon opens the swap choice; `attack2.pressed` then replaces slot 2, no attack starts, and the old weapon lies at the player's feet on the same tick.
10. The weapon swap choice closes without a swap on a second interact press, on leaving the item's box, and on taking damage. Under Butterfingers an `attack2` press is refused and the choice stays open; with slot 1 full and slot 2 empty, interact opens the choice instead of filling slot 2.
11. A shop weapon bought through the swap choice takes the gold only on the confirming tick; cancelling takes none.
12. Ability altar: interact held 90 ticks sells; released after 89 ticks upgrades (if affordable and below Lv5) and sells nothing.
13. Damage numbers: two secondary hits on one target 0.10 s apart give one number with the summed amount; a 33rd live number removes the oldest; with the setting off, 20 hits create 0 numbers.
14. The player losing 12 HP shows `12` in `bad`; taking Vitality (+20 max, +20 HP) shows no `+20`.
15. Restart ring: `restartHoldTicks` 11 → hidden; 30 → 8 of 16 dots lit; 60 → all 16.
16. Info line: a pending timed door 700 px away shows nothing; at 600 px with `timeLimit` 120 and `stageTicks` 13 800 it shows `DOOR 0:05.00` in `text`, and at 13 801 ticks in `bad`.
17. Default bindings: `KeyJ` → `attack1`, `Space` → `jump`, `ShiftLeft` → `dash`, pad 5 → `dash`; pad 7 with value 0.6 → `ability2` held, 0.4 → not held.
18. Rebinding `attack1` Key 1 to `KeyK` gives `attack2` Key 1 = `KeyJ`. Clearing `jump`'s only key is refused. Capturing `Escape` or `F5` is ignored. Pad Start can't be captured.
19. Settings with a missing field load with that field's default; an invalid `bindings` object resets all bindings; `volume.music = 55` loads as 70.
20. Key labels: `ShiftLeft` → `SHF`, `KeyJ` → `J`, `ArrowLeft` → `←`, `Numpad5` → `N5`, `F13` → `F13`.
21. Prompt style `auto`: after a `keydown` the HUD shows keyboard glyphs; after a pad press with id containing `054c`, PlayStation glyphs; with another id, Xbox. Rebinding Jump to `KeyZ` makes the `jump` hint show `Z`.
22. Stat pick: highlights the middle card, ignores a confirm at 0.29 s, accepts one at 0.30 s; the chosen upgrade is the highlighted one.
23. Route choice: the cursor starts on `save.lastRoad`; back leaves the road unchanged; confirm on Forest sets the road to `forest`.
24. Death screen: confirms in its first 0.25 s are ignored; cause `spikes` shows `Killed by spikes`; cause `bandit_archer` shows `Killed by Bandit Archer`.
25. After Resume is confirmed with Jump, the held Jump is not seen by the core as pressed or held until released.
26. `luckyResult swift` shows banner `SWIFT` in `good`; a second `luckyResult` 0.5 s later replaces it at once. Two `split` events queue and show one after the other.
27. Every string in `strings.ts` and every generated label uses only characters in the font charset.
28. (e2e) With a full loadout, a boss bar, 4 two-line toasts, 13 effects and a 1-hour run timer, every HUD layout box lies inside x 8–632, y 8–352 and no two layout boxes overlap.
29. (e2e) With screen shake on, HUD positions are identical across 10 frames of a shake, while world-anchored prompts move with the shake offset.
30. Title: a pad button press in step 1 goes to step 2; with `sound.locked` true, step 2 draws `Press a key or click to enable sound` at y 316; with `sound.locked` false it draws no such line. With a newer-version save and locked sound, the warning (y 300) and the sound prompt (y 316) do not overlap.
31. `theme.ts` element colors equal 08 §3.5's main colors: Fire #ff7a2e, Ice #8fdcff, Lightning #ffe94a, Poison #78d94a, Wind #b9f2dc.
