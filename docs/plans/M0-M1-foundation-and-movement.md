# M0 + M1: Foundation and Movement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable grey-box test level, hosted at a link, where the player character has every move from the movement spec (run, jump, double jump, dash, slide, crawl, wall slide, wall jump, ledge grab, dive slam, drop-through) with exact, tested numbers.

**Architecture:** All movement rules live in pure TypeScript under `src/core/` (no Phaser imports) and run at a fixed 120 ticks/s on an `InputState` per tick. They are unit-tested with Vitest. A thin Phaser 4 scene reads keyboard/gamepad into `InputState`, steps the core with a fixed-step accumulator, and draws grey boxes. Playwright drives the real build through a `window.__game` debug API and takes screenshots.

**Tech Stack:** Phaser 4.2.1 (pinned), TypeScript ~6.0 (strict), Vite ^8.3, Vitest ^5.0, @playwright/test 1.56.1 (matches the preinstalled Chromium), Node 22, GitHub Pages.

**Spec:** `docs/spec/00-README.md` (stack, units, architecture), `docs/spec/01-movement.md` (every movement rule and number; section numbers below like "§6.4" refer to this file unless another file is named), `docs/spec/07-ui-hud-controls.md` §8.1–8.2 (default keys, gamepad reading). Read all three before starting.

## Global Constraints

- Phaser is pinned exactly: `"phaser": "4.2.1"`. Most examples online are Phaser 3; check every API against the installed Phaser 4 type definitions.
- `src/core/` never imports Phaser. Code in `src/core/` must run under Vitest in Node.
- Simulation: fixed **120 ticks/s**, `TICK = 1/120`. Durations convert with `Math.round(seconds * 120)` in `src/core/tuning.ts` only.
- Units: pixels and seconds; +x right, +y down; game resolution **640 × 360**; tiles **16 × 16**.
- Every movement number comes from 01 §4 and lives in `MOVE` in `src/core/tuning.ts`. No magic numbers elsewhere.
- No `Math.random()` anywhere in `src/core/`. (M1 needs no randomness; camera shake and the seeded RNG arrive in M2.)
- Rendering: `pixelArt: true`, `roundPixels: true`, integer zoom only (2×, 3×, …), black bars around the game.
- Playwright uses `/opt/pw-browsers/chromium` with `--enable-unsafe-swiftshader`. Never run `playwright install`.
- Commit after every task. Push to the branch your session was given.

## Review Focus

1. **Different monitor refresh rates** (60 Hz, 144 Hz, a dropped frame): movement must be identical because the core only advances in whole 120 Hz ticks. Pinned by `FixedStepper` tests in Task 3 and the replay test in Task 14.
2. **Long hitch or background tab** (the browser pauses for 3 s): the game must not try to run 360 catch-up ticks. The 0.25 s accumulator cap is pinned in Task 3.
3. **Window loses focus while a key is held** (alt-tab while holding right): the character must not keep running forever. Pinned by the `releaseAll()` on `blur` test in Task 4 and wired in Task 15.
4. **Tap shorter than one tick** (a press and release between two ticks, common on fast keyboards): the jump must still happen. Pinned by the latching test in Task 4.
5. **Pressing left and right together** (common while changing direction fast): the most recent one wins, and releasing it falls back to the other. Pinned in Task 4.

---

## File structure

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, .gitignore
.github/workflows/deploy.yml          GitHub Pages deploy (build + upload + deploy)
src/
  main.ts                             Phaser config, integer zoom, scene list
  core/
    tuning.ts                         TICK_RATE, TICK, ticks(), MOVE (01 §4)
    input.ts                          ButtonState, InputState, emptyInput()
    sim/fixedStep.ts                  FixedStepper (accumulator, 0.25 s cap)
    sim/playerSim.ts                  PlayerSim: body + world + camera + modifiers, step(InputState), stepSpec(InputSpec)
    level/tiles.ts                    TileKind, TileGrid (tile + pixel queries)
    level/build.ts                    gridFromRects() level builder
    physics/collide.ts                boxFree, moveX, moveY, stepUp, ceilingNudge, isGrounded, pushOut (01 §2)
    player/body.ts                    PlayerBody, MoveStateId, MoveEvent, createPlayerBody() (01 §15)
    player/modifiers.ts               MoveModifiers, MoveContext, defaultModifiers() (01 §12.1)
    player/movement.ts                stepPlayer(): per-tick order (01 §3), running + gravity (01 §5)
    player/jump.ts                    jump priority, cut, coyote, buffer, double jump, drop-through (01 §6, §13.1)
    player/dash.ts                    dash, slide, crawl, refundDash (01 §7, §9)
    player/wall.ts                    wall contact, wall slide, wall jump (01 §8)
    player/ledge.ts                   ledge grab trigger + climb + cancels (01 §10)
    player/dive.ts                    dive slam phases, onDiveHit (01 §11)
    camera.ts                         CameraState, createCamera, stepCamera, snapCamera (01 §14, no zones/shake yet)
    testkit/worlds.ts                 flatWorld(), worldFromRects() for tests
    testkit/measure.ts                helpers to measure peaks/distances in tests
  data/levels/movementTest.ts         The M1 grey-box test level (rect list)
  game/
    input/snapshot.ts                 SnapshotBuilder (pure TS, no Phaser): latching, device merge, last-pressed-wins
    input/devices.ts                  Phaser keyboard + gamepad → SnapshotBuilder (07 §8.1–8.2)
    scenes/MovementTestScene.ts       Draws grid + player, fixed-step loop, camera copy
    debug.ts                          window.__game API + ?debug=1 overlay
tests/e2e/
  boot.spec.ts                        boots, no errors, integer zoom, screenshot
  movement.spec.ts                    drives the real build via window.__game
```

Unit tests live next to the code as `*.test.ts`.

---

## M0 — Project foundation

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `.gitignore`, `src/main.ts`, `src/core/tuning.ts`, `src/core/tuning.test.ts`, `tests/e2e/boot.spec.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `typecheck`, `test`, `build`, `preview`, `test:e2e` (as in `CLAUDE.md`); `src/core/tuning.ts` exports `TICK_RATE`, `TICK`, `ticks(seconds: number): number`.

These exact config files were verified to install, typecheck, test, build and pass a Playwright run in this cloud environment.

- [ ] **Step 1: Write the config files**

`package.json`:
```json
{
  "name": "rushblade",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "test:e2e": "npm run build && playwright test"
  },
  "dependencies": { "phaser": "4.2.1" },
  "devDependencies": {
    "typescript": "~6.0.3",
    "vite": "^8.3.4",
    "vitest": "^5.0.5",
    "@playwright/test": "1.56.1"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2023", "module": "esnext", "lib": ["ES2023", "DOM"], "types": ["vite/client"],
    "skipLibCheck": true, "moduleResolution": "bundler", "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true, "moduleDetection": "force", "noEmit": true,
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true, "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts` (import `defineConfig` from `vitest/config`, not `vite`, or the `test` key fails typecheck):
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: './',
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    launchOptions: { executablePath: '/opt/pw-browsers/chromium', args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 30_000 },
});
```

`index.html`: a `<div id="game">` and `<script type="module" src="/src/main.ts">`, page title `RUSHBLADE`, CSS `html,body{margin:0;height:100%;background:#000;overflow:hidden}`.

`.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`.

- [ ] **Step 2: Write the failing test** `src/core/tuning.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { TICK_RATE, TICK, ticks } from './tuning.ts';

describe('tuning', () => {
  it('runs at 120 ticks per second', () => {
    expect(TICK_RATE).toBe(120);
    expect(TICK).toBeCloseTo(1 / 120, 12);
  });
  it('converts seconds to ticks with Math.round', () => {
    expect(ticks(0.15)).toBe(18);
    expect(ticks(0.35)).toBe(42);
    expect(ticks(0.10)).toBe(12);
    expect(ticks(0.05)).toBe(6);
  });
});
```

- [ ] **Step 3: Install and see it fail**

Run: `npm install && npm test`
Expected: FAIL, `Cannot find module './tuning.ts'` (or similar).

- [ ] **Step 4: Implement `TICK_RATE = 120`, `TICK = 1 / TICK_RATE`, `ticks(seconds) => Math.round(seconds * TICK_RATE)` in `src/core/tuning.ts`**

- [ ] **Step 5: Minimal `src/main.ts` and boot e2e test**

`src/main.ts`: a Phaser game (640 × 360, `pixelArt: true`, `roundPixels: true`, `backgroundColor: '#1d2030'`, parent `game`) with one placeholder scene that draws a grey floor rectangle and sets `window.__game = { ready: true }` in `create()`.

`tests/e2e/boot.spec.ts`: listens for `pageerror`, opens `/?debug=1`, waits for `window.__game?.ready === true`, saves `test-results/boot.png`, and asserts no page errors.

- [ ] **Step 6: Run everything**

Run: `npm run typecheck && npm test && npm run test:e2e`
Expected: typecheck clean; `2 passed` (Vitest); `1 passed` (Playwright). Look at `test-results/boot.png` with the Read tool: dark background, grey floor.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts playwright.config.ts index.html .gitignore src tests
git commit -m "chore: scaffold Phaser 4 + TypeScript + Vite + Vitest + Playwright"
```

### Task 2: Integer scaling and GitHub Pages deploy

**Files:**
- Modify: `src/main.ts`
- Create: `.github/workflows/deploy.yml`
- Modify: `tests/e2e/boot.spec.ts`

**Interfaces:**
- Produces: `computeZoom(windowW: number, windowH: number): number` exported from `src/main.ts`'s helper module `src/game/zoom.ts` (pure).

- [ ] **Step 1: Write the failing tests**

`src/game/zoom.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeZoom } from './zoom.ts';
describe('computeZoom', () => {
  it('uses the largest whole number that fits', () => {
    expect(computeZoom(1280, 720)).toBe(2);
    expect(computeZoom(1920, 1080)).toBe(3);
    expect(computeZoom(2560, 1440)).toBe(4);
    expect(computeZoom(1000, 600)).toBe(1);
    expect(computeZoom(1919, 1080)).toBe(2);
  });
  it('never goes below 1', () => {
    expect(computeZoom(300, 200)).toBe(1);
  });
});
```

Add to `tests/e2e/boot.spec.ts`: at viewport 1280 × 720 the canvas's CSS box is 1280 × 720; after `page.setViewportSize({ width: 1000, height: 600 })` and a resize, it is 640 × 360 and centered.

- [ ] **Step 2: Run to see them fail** — `npm test` (module missing), `npm run test:e2e` (size assertions fail).

- [ ] **Step 3: Implement**
  - `computeZoom(w, h) = max(1, floor(min(w / 640, h / 360)))` in `src/game/zoom.ts`.
  - In `src/main.ts`: Phaser scale mode with no automatic stretching (`Phaser.Scale.NONE`), base size 640 × 360, `autoCenter: CENTER_BOTH`; on start and on every window `resize`, set the zoom to `computeZoom(innerWidth, innerHeight)` (Phaser 4 ScaleManager zoom; check the method name in Phaser 4's types). The page background stays black (the bars).

- [ ] **Step 4: Deploy workflow** `.github/workflows/deploy.yml`

On `push` to `main` and on `workflow_dispatch`: checkout, setup Node 22 with npm cache, `npm ci`, `npm test`, `npm run build`, upload `dist/` as the Pages artifact, deploy to GitHub Pages. Permissions: `contents: read`, `pages: write`, `id-token: write`. Use the current major versions of `actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`, `actions/deploy-pages`. Concurrency group `pages`, cancel-in-progress false.

- [ ] **Step 5: Run** `npm run typecheck && npm test && npm run test:e2e` — all pass. Read the screenshots.

- [ ] **Step 6: Commit** `git commit -m "feat: integer zoom scaling and GitHub Pages deploy workflow"`

- [ ] **Step 7: Tell the user (one time)** that to get the play link they must: (1) in the GitHub repo, open Settings → Pages and set **Source: GitHub Actions**; (2) merge this branch into `main` (or ask you to open a pull request). The link will be `https://<owner>.github.io/platformer/`. Until then they can't play it from a link.

---

## M1 — Movement

### Task 3: Fixed-step clock

**Files:**
- Create: `src/core/sim/fixedStep.ts`, `src/core/sim/fixedStep.test.ts`

**Interfaces:**
- Produces: `class FixedStepper { constructor(maxFrameSeconds = 0.25); advance(dtSeconds: number): number }`. `advance` adds `min(dt, maxFrameSeconds)` to an accumulator and returns how many whole ticks (1/120 s) to run now, keeping the remainder.

- [ ] **Step 1: Write the failing tests**

```ts
it('runs 2 ticks for a 60 Hz frame', () => { expect(new FixedStepper().advance(1 / 60)).toBe(2); });
it('averages 120 ticks per second at 144 Hz', () => {
  const s = new FixedStepper(); let n = 0;
  for (let i = 0; i < 144; i++) n += s.advance(1 / 144);
  expect(n).toBeGreaterThanOrEqual(119); expect(n).toBeLessThanOrEqual(120);
});
it('carries the remainder', () => {
  const s = new FixedStepper();
  expect(s.advance(0.005)).toBe(0);   // 0.6 ticks
  expect(s.advance(0.005)).toBe(1);   // 1.2 ticks total
});
it('caps a long hitch at 0.25 s (30 ticks)', () => { expect(new FixedStepper().advance(3)).toBe(30); });
it('ignores negative or NaN dt', () => {
  const s = new FixedStepper();
  expect(s.advance(-1)).toBe(0); expect(s.advance(Number.NaN)).toBe(0);
});
```

- [ ] **Step 2: Run** `npx vitest run src/core/sim/fixedStep.test.ts` — FAIL (module missing).
- [ ] **Step 3: Implement** `FixedStepper`. Use an integer tick accumulator in microseconds or compare with a small epsilon so 2 × (1/120) s never yields 1 tick from float error.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(core): fixed 120 Hz stepper with hitch cap"`

### Task 4: Input snapshot

**Files:**
- Create: `src/core/input.ts`, `src/game/input/snapshot.ts`, `src/game/input/snapshot.test.ts`

**Interfaces:**
- Produces (`src/core/input.ts`): `ButtonState`, `InputState` exactly as 01 §1.1; `emptyInput(): InputState`.
- Produces (`src/game/input/snapshot.ts`, no Phaser import):
  - `type ButtonId = 'jump' | 'dash' | 'attack1' | 'attack2' | 'ability1' | 'ability2' | 'heal' | 'interact' | 'restart' | 'pause'`
  - `type DirId = 'left' | 'right' | 'up' | 'down'`
  - `type Source = 'kb' | 'pad'`
  - `class SnapshotBuilder { down(id: ButtonId | DirId, src: Source): void; up(id: ButtonId | DirId, src: Source): void; setStick(x: number, y: number): void; releaseAll(): void; build(): InputState }`
  - `build()` returns this tick's snapshot and clears the latched `pressed`/`released` flags.

- [ ] **Step 1: Write the failing tests** (01 §1.2, Test checklist 29)

```ts
it('latches a press+release between ticks', () => {
  const b = new SnapshotBuilder(); b.down('jump', 'kb'); b.up('jump', 'kb');
  const s = b.build(); expect(s.jump).toEqual({ held: false, pressed: true, released: true });
  expect(b.build().jump.pressed).toBe(false);          // only one tick
});
it('pressed is true for exactly one tick while held', () => {
  const b = new SnapshotBuilder(); b.down('dash', 'kb');
  expect(b.build().dash).toMatchObject({ held: true, pressed: true });
  expect(b.build().dash).toMatchObject({ held: true, pressed: false });
});
it('merges keyboard and gamepad', () => {
  const b = new SnapshotBuilder(); b.down('jump', 'kb'); b.down('jump', 'pad'); b.up('jump', 'kb');
  expect(b.build().jump.held).toBe(true);
});
it('last pressed direction wins and falls back on release', () => {
  const b = new SnapshotBuilder(); b.down('left', 'kb'); b.down('right', 'kb');
  expect(b.build().moveX).toBe(1);
  b.up('right', 'kb'); expect(b.build().moveX).toBe(-1);
});
it('stick thresholds: 0.30 horizontal, 0.60 down', () => {
  const b = new SnapshotBuilder();
  b.setStick(0.29, 0); expect(b.build().moveX).toBe(0);
  b.setStick(0.30, 0); expect(b.build().moveX).toBe(1);
  b.setStick(0, 0.59); expect(b.build().moveY).toBe(0);
  b.setStick(0, 0.60); expect(b.build().moveY).toBe(1);
});
it('releaseAll clears every held button and direction (window blur)', () => {
  const b = new SnapshotBuilder(); b.down('right', 'kb'); b.down('jump', 'pad'); b.releaseAll();
  const s = b.build(); expect(s.moveX).toBe(0); expect(s.jump.held).toBe(false);
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Stick crossing a threshold counts as a direction "press" for the last-pressed-wins rule; stick returning under the threshold counts as a release.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(input): InputState and latching snapshot builder"`

### Task 5: Tile grid, level builder, test level

**Files:**
- Create: `src/core/level/tiles.ts`, `src/core/level/build.ts`, `src/core/level/tiles.test.ts`, `src/core/testkit/worlds.ts`, `src/data/levels/movementTest.ts`, `src/data/levels/movementTest.test.ts`

**Interfaces:**
- Produces (`tiles.ts`):
  - `type TileKind` exactly as 01 §13.
  - `class TileGrid { readonly w: number; readonly h: number; readonly widthPx: number; readonly heightPx: number; kindAt(tx: number, ty: number): TileKind; isSolidPx(px: number, py: number): boolean; isOneWayTopPx(px: number, py: number): boolean }`.
  - `kindAt` outside the map returns `'solid'` (all four map edges are solid, 01 §2.3). `isSolidPx` is true for `solid` and `ice` tiles. `isOneWayTopPx(px, py)` is true when the tile containing `(px, py)` is `oneway` **and** `py` is that tile's top pixel row.
- Produces (`build.ts`): `type Rect = { x0: number; y0: number; x1: number; y1: number; kind: TileKind }` (inclusive tile coords); `gridFromRects(w: number, h: number, rects: Rect[]): TileGrid` (starts all `empty`, applies rects in order, later rects overwrite).
- Produces (`testkit/worlds.ts`): `flatWorld(wTiles = 60, hTiles = 30): TileGrid` (floor = rows `hTiles-3 .. hTiles-1` solid); `FLOOR_Y(hTiles = 30) = (hTiles - 3) * 16` (feet y when standing on the floor).
- Produces (`movementTest.ts`): `MOVEMENT_TEST: { grid: TileGrid; spawn: { x: number; y: number } }`.

**The M1 test level** (120 × 30 tiles = 1920 × 480 px). Rects in order:

| # | Rect (tiles, inclusive) | Kind | Purpose |
|---|---|---|---|
| 1 | x 0–119, y 27–29 | solid | Floor (feet y 432) |
| 2 | x 0–0, y 0–29 and x 119–119, y 0–29 | solid | Side walls (visual; edges are solid anyway) |
| 3 | x 24–27, y 22–26 | solid | Ledge 80 px up (one jump + ledge grab) |
| 4 | x 31–34, y 21–26 | solid | Ledge 96 px up (needs the double jump) |
| 5 | x 40–47, y 18–25 | solid | Wall with a 16 px tunnel under it (slide through) |
| 6 | x 53–53, y 6–24 | solid | Shaft left wall (32 px opening at the bottom to walk in) |
| 7 | x 58–58, y 6–26 | solid | Shaft right wall (wall-jump up the 64 px shaft; was 96 px before playtest) |
| 8 | x 58–75, y 5–5 | solid | Platform at the top of the shaft (exit right, drop down) |
| 9 | x 80–84, y 24–24 | oneway | One-way platform 48 px up |
| 10 | x 87–91, y 20–20 | oneway | One-way platform 64 px above #9 (double jump) |
| 11 | x 80–84, y 16–16 | oneway | One-way platform 64 px above #10 |
| 12 | x 95–99, y 23–23 | solid | Low overhang, 48 px clearance (ceiling nudge feel) |
| 13 | x 104–111, y 27–28 | empty | 128 px pit with a floor at row 29 (needs a dash-jump) |

Spawn: `{ x: 72, y: 432 }` (feet on the floor at tile x 4).

- [ ] **Step 1: Write the failing tests**

`tiles.test.ts`: outside the map is solid (`kindAt(-1, 0)`, `kindAt(0, 999)`); `isSolidPx` maps pixels to tiles (`isSolidPx(16, 432)` true on `flatWorld()`, `isSolidPx(16, 431)` false); `isOneWayTopPx` is true only on the top pixel row of a one-way tile (top row true, row +1 false); later rects overwrite earlier ones.

`movementTest.test.ts` (geometry the level designer promised):
```ts
const g = MOVEMENT_TEST.grid;
it('is 120 x 30 tiles', () => { expect([g.w, g.h]).toEqual([120, 30]); });
it('spawn stands on the floor in free space', () => {
  expect(g.isSolidPx(72, 432)).toBe(true); expect(g.isSolidPx(72, 431)).toBe(false);
});
it('ledges are 80 px and 96 px above the floor', () => {
  expect(g.kindAt(24, 22)).toBe('solid'); expect(g.kindAt(24, 21)).toBe('empty');   // 432 - 22*16 = 80
  expect(g.kindAt(31, 21)).toBe('solid'); expect(g.kindAt(31, 20)).toBe('empty');   // 432 - 21*16 = 96
});
it('the tunnel under the wall is exactly 16 px high', () => {
  for (let x = 40; x <= 47; x++) { expect(g.kindAt(x, 25)).toBe('solid'); expect(g.kindAt(x, 26)).toBe('empty'); }
});
it('the pit is 128 px wide with a floor', () => {
  for (let x = 104; x <= 111; x++) { expect(g.kindAt(x, 27)).toBe('empty'); expect(g.kindAt(x, 29)).toBe('solid'); }
  expect(g.kindAt(103, 27)).toBe('solid'); expect(g.kindAt(112, 27)).toBe('solid');
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(level): tile grid, rect builder and M1 test level"`

### Task 6: Collision

**Files:**
- Create: `src/core/physics/collide.ts`, `src/core/physics/collide.test.ts`

**Interfaces:**
- Consumes: `TileGrid` (Task 5).
- Produces:
  - `interface AABBBody { x: number; y: number; w: number; h: number; remX: number; remY: number }` (x = center, y = feet; 01 §2.1)
  - `boxFree(g: TileGrid, x: number, y: number, w: number, h: number): boolean` — no solid pixel in `[x - w/2, x + w/2) × [y - h, y)`.
  - `moveX(b: AABBBody, g: TileGrid, amount: number, allowStepUp: boolean): 'free' | 'wall'` — 01 §2.4 `moveX` incl. §2.7 step-up.
  - `moveY(b: AABBBody, g: TileGrid, amount: number, opts: { dropping: boolean; preferDir: -1 | 0 | 1 }): 'free' | 'landed' | 'bonk'` — 01 §2.4 `moveY` incl. §2.6 one-way and §2.7 ceiling nudge (`preferDir` = `moveX`).
  - `isGrounded(b: AABBBody, g: TileGrid, vy: number): boolean` — 01 §2.5.
  - `pushOut(b: AABBBody, g: TileGrid): boolean` — 01 §2.8; returns false if nothing free within 32 px.
  - `roundHalfAwayFromZero(v: number): number`.

- [ ] **Step 1: Write the failing tests** (all on `flatWorld()` or `gridFromRects`)

- `roundHalfAwayFromZero(0.5) === 1`, `(-0.5) === -1`, `(0.49) === 0`.
- Landing is exact (Test checklist 41): a 12 × 28 body falling with `amount` 3.7, 5, 0.2 per tick always ends with `y === 432` and `moveY` returns `'landed'`; never 431 or 433.
- 600 px/s never tunnels: a body moving 5 px/tick into a 1-tile wall stops touching it.
- Ceiling nudge (Test checklist 20): rising into a ceiling tile whose edge overlaps the body by 4 px → `'free'` and `x` shifted by 4; overlap 5 px → `'bonk'`.
- Step-up: walking into a 4 px high block steps onto it (`y` decreases by 4); a 5 px block stops (`'wall'`). Step-up is skipped when `allowStepUp` is false.
- One-way: rising through a one-way tile is never blocked; falling onto it lands with feet on its top; with `dropping: true` it doesn't land on the platform it is dropping from.
- `isGrounded`: true standing on floor with `vy` 0; false with `vy < 0`; true on a one-way top.
- `pushOut`: a body placed 3 px inside a wall from the left ends free; the order up → left → right → down is respected (a body overlapped from above and the side moves up first if up is free within the same `d`).

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** exactly as 01 §2.4–2.8. **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(physics): pixel-step AABB collision with corner forgiveness"`

### Task 7: Player body, sim wrapper, running and falling

**Files:**
- Create: `src/core/player/body.ts`, `src/core/player/modifiers.ts`, `src/core/player/movement.ts`, `src/core/sim/playerSim.ts`, `src/core/testkit/measure.ts`, `src/core/player/movement.test.ts`
- Modify: `src/core/tuning.ts` (add `MOVE`)

**Interfaces:**
- Consumes: `TileGrid`, collision functions, `InputState`, `emptyInput`.
- Produces:
  - `src/core/tuning.ts`: `MOVE` with every row of 01 §4, using the spec's names. Rows given in seconds also get a `_TICKS` twin computed with `ticks()`: e.g. `DASH_TIME: 0.15` and `DASH_TICKS: 18`, `COYOTE: 0.10` and `COYOTE_TICKS: 12`, `DASH_COOLDOWN: 0.35` and `DASH_COOLDOWN_TICKS: 42`.
  - `src/core/player/body.ts`: `MoveStateId`, `MoveEvent`, `PlayerBody` (01 §15; `PlayerBody` extends `AABBBody`); `createPlayerBody(x: number, y: number): PlayerBody` (state `ground`, facing 1, `airDashAvailable` and `doubleJumpAvailable` true, `dashReadyPt` 0, all press stamps `-1000`).
  - `src/core/player/modifiers.ts`: `MoveModifiers` (01 §12.1), `defaultModifiers(): MoveModifiers` (all neutral: `speedPercents []`, mults 1, `canJump/canDoubleJump/canDash` true, `rooted` false, `maxFallOverride` null), `interface MoveContext { slotUsable: [boolean, boolean] }`, `speedMult(m: MoveModifiers): number` (01 §5.2 clamp 0.5–1.8).
  - `src/core/player/movement.ts`: `stepPlayer(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers, ctx: MoveContext): MoveEvent[]` — the per-tick order of 01 §3 (step 1 hit-stop is a no-op until M2: keep a `hitStopTicks` field at 0).
  - `src/core/sim/playerSim.ts`:
    - `interface InputSpec { moveX?: -1 | 0 | 1; moveY?: -1 | 0 | 1; jump?: boolean; dash?: boolean; attack1?: boolean; attack2?: boolean }` (held flags)
    - `specToInput(prev: InputSpec, next: InputSpec): InputState` (`pressed` = held now and not before; `released` = the reverse)
    - `class PlayerSim { body: PlayerBody; mods: MoveModifiers; ctx: MoveContext; camera: CameraState; tick: number; constructor(g: TileGrid, spawn: { x: number; y: number }); step(input: InputState): MoveEvent[]; stepSpec(spec: InputSpec, n?: number): MoveEvent[] }` — `ctx.slotUsable` defaults to `[true, true]` in M1 (no weapons yet; dive slam needs a "usable weapon"). Until Task 13, `camera` may be a stub; Task 13 fills it in.
  - `src/core/testkit/measure.ts`: `peakRise(sim: PlayerSim, run: () => void): number` (max of `startY - y` while `run` executes, start = `y` before), `ticksUntil(sim: PlayerSim, spec: InputSpec, pred: (b: PlayerBody) => boolean, max = 2000): number`.

- [ ] **Step 1: Write the failing tests** (01 §5, Test checklist 4, 9, 15, 28)

- From standstill holding right: `vx` is 170 on tick 12 and not before; releasing on the ground at 170 → `vx` 0 within 9 ticks.
- With `mods.speedPercents = [0.45]`: run speed settles at 246.5 px/s.
- `speedMult` clamps: `[2]` → 1.8; `[-1]` → 0.5.
- Turning: at +170 holding left reaches −170 in at most 18 ticks (ground turn 2400 px/s²).
- Falling: `vy` caps at 400; at 520 while holding down. On a tall world (`gridFromRects(10, 140, [floor rows 137–139])`, 2240 px tall), a body dropped from 2000 px above the floor lands exactly on the floor in state `ground` (no fall damage exists; HP arrives in M2).
- Overspeed: with `vx` set to 300 on the ground holding right, `vx` decays by `1600 × TICK` per tick and stops at 170 (never below).
- Events: landing emits `'land'`.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** 01 §3 order, §5.2–5.5 (`air`, `ground` states; other states arrive in later tasks). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(player): body, sim wrapper, running and falling"`

### Task 8: Jumping

**Files:**
- Create: `src/core/player/jump.ts`, `src/core/player/jump.test.ts`
- Modify: `src/core/player/movement.ts` (call jump logic at §3 step 5b and 5d)

**Interfaces:**
- Consumes: `PlayerBody`, `PlayerSim`, collision.
- Produces: `tryJump(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers): MoveEvent | null` (01 §6.4 priority 1, 2, 4 now; wall jump hooks in Task 10) and `applyJumpCut(b: PlayerBody, input: InputState): void` (§6.3).

- [ ] **Step 1: Write the failing tests** (01 §6, Test checklist 1, 2, 3, 12, 13)

```ts
it('full jump peaks 56 px on tick 33 (±1)', ...)        // jump held throughout
it('1-tick jump peaks 14 px; 1-tick double jump rises 10 px', ...)
it('held double jump at the apex peaks 96 px above the floor', ...)
it('coyote: jump on the 12th tick after leaving the ground is a ground jump; on the 13th it is a double jump', ...)
it('buffer: a press 10 ticks before landing fires on the tick after landing; a press 12 ticks before does not', ...)
it('a jump keeps vx (running jump lands 92-94 px away at 170 px/s)', ...)
it('emits jump / doubleJump events', ...)
```
Build the coyote test on `gridFromRects` with a ledge: floor block x 0–9, empty beyond, lower floor 10 tiles down.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** §6.1–6.4 (ground jump, double jump, cut, buffer window `pt - jumpPressPt < 12`, coyote `pt - lastGroundPt <= 12`, `jumpPressFresh`). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(player): ground jump, double jump, jump cut, coyote time, jump buffer"`

### Task 9: Dash, slide and crawl

**Files:**
- Create: `src/core/player/dash.ts`, `src/core/player/dash.test.ts`
- Modify: `src/core/player/movement.ts`, `src/core/player/jump.ts` (jump from `dash`/`slide`, §6.4)

**Interfaces:**
- Produces: `tryStartDash(b: PlayerBody, input: InputState, g: TileGrid, mods: MoveModifiers): MoveEvent | null` (§7.1/§9.1), `stepDashOrSlide(b: PlayerBody, ...)` (§7.2–7.3, §9.2–9.3), `refundDash(b: PlayerBody): void` (§7.4).

- [ ] **Step 1: Write the failing tests** (01 §7, §9, Test checklist 5, 6, 7, 8, 10, 11, 14, 35)

- Ground dash moves exactly 60 px over 18 ticks; `dashIframes` true on those 18 ticks, false on the 19th.
- Air dash: `vy` 0 and `y` unchanged every dash tick.
- Second air dash in the same airtime is refused; after landing, a dash is refused until 42 ticks after the first dash ended.
- Buffer: a dash pressed 6 ticks before the cooldown ends fires on the first ready tick; pressed 13 ticks before, it doesn't.
- "Never slows you": dashing while already moving at 300 px/s in the same direction keeps 300.
- Dash-jump on dash tick 1 lands 136–140 px from the jump point.
- Slide (down + dash on the ground): 99 px over 36 ticks, box 12 × 14, passes through the 16 px tunnel of the test level; standing up is refused under the ceiling.
- Slide ending under a 1-tile ceiling enters `crawl`; becomes `ground` the first tick 12 × 28 fits; crawl speed max 80 px/s; jump refused in crawl (press stays buffered).
- `dashCooldownMult` 0.8 → 34 ticks, 1.6 → 67, 2 → 84 (round half up).
- `refundDash()` makes a dash available on the same tick.
- Events `dashStart`, `dashEnd`, `slideStart`, `slideEnd`.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(player): dash, slide, crawl and dash cooldown"`

### Task 10: Wall slide and wall jump

**Files:**
- Create: `src/core/player/wall.ts`, `src/core/player/wall.test.ts`
- Modify: `src/core/player/movement.ts`, `src/core/player/jump.ts` (priority 3)

**Interfaces:**
- Produces: `wallGap(b: PlayerBody, g: TileGrid, side: 1 | -1): number` (§8.1, measured on row `y - 14`; returns a large number if no wall within 8 px), wall slide enter/leave (§8.2), `wallJump(b: PlayerBody, ...)` (§8.3).

- [ ] **Step 1: Write the failing tests** (01 §8, Test checklist 15, 16, 17)

- Wall slide caps falling at 90 px/s (400 holding down); air dash and double jump are **not** refreshed by sliding.
- Wall jump without release rises 48 px, moves 25–26 px away during the 14-tick lock, refreshes air dash and double jump.
- Gap 3 px → wall jump; gap 4 px → double jump.
- Wall coyote: leaving the wall and pressing jump within 12 ticks is a wall jump away from it.
- During the 14-tick lock, input doesn't change `vx`; a dash ends the lock.
- Single-wall climbing works: in the test level's shaft, alternating wall jumps reach the top platform (row 5) within 10 s of ticks.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(player): wall slide and wall jump"`

### Task 11: Ledge grab

**Files:**
- Create: `src/core/player/ledge.ts`, `src/core/player/ledge.test.ts`
- Modify: `src/core/player/movement.ts`

**Interfaces:**
- Produces: `checkLedgeGrab(b: PlayerBody, input: InputState, g: TileGrid): boolean` (§10.1, starts `ledgeClimb`), climb stepping (§10.2), cancels (§10.3).

- [ ] **Step 1: Write the failing tests** (01 §10, Test checklist 18, 19)

- Jumping next to the 80 px ledge of the test level while holding toward it: grab at the apex, `ground` on top of the ledge 18 ticks later, standing 8 px past the wall face.
- The 96 px ledge can't be reached with one jump; it can with jump + double jump.
- With a ceiling 20 px above the ledge (room check fails), no grab.
- Jump during the climb snaps to the standing spot and does a ground jump with `vx = facing * runMaxEff`; dash during the climb does a ground dash.
- `ledgeGrab` event fires once.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(player): automatic ledge grab and climb"`

### Task 12: Dive slam and drop-through

**Files:**
- Create: `src/core/player/dive.ts`, `src/core/player/dive.test.ts`
- Modify: `src/core/player/movement.ts`, `src/core/player/jump.ts` (priority 1 drop-through)

**Interfaces:**
- Produces: `tryStartDive(b: PlayerBody, input: InputState, ctx: MoveContext): MoveEvent | null` (§11.1), dive phase stepping (§11.2), `onDiveHit(b: PlayerBody): void` (the bounce; M2's combat will call it — tests call it directly).

- [ ] **Step 1: Write the failing tests** (01 §11, §13.1, Test checklist 21, 22)

- Down + attack1 in the air: hovers 6 ticks (`vx = vy = 0`), then falls at 600 px/s; on landing → `diveLand` for 12 ticks; a jump cancels `diveLand`.
- `onDiveHit()` during `diveFall` → `vy` −360, `vx` 0, state `air`, both refreshes true, not cuttable; a second dive can start immediately.
- With `ctx.slotUsable = [false, true]`, down + attack1 starts no dive; down + attack2 does.
- No dive on a tick where a jump started.
- Drop-through: down + jump (fresh press) on a one-way platform → `y` + 1, state `air`, `vy` 0, no coyote jump afterwards; down + jump on solid ground is a normal jump; a buffered press never drops through.
- Events `diveStart`, `diveLand`, `diveBounce`, `dropThrough`.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(player): dive slam, bounce hook and drop-through"`

### Task 13: Camera

**Files:**
- Create: `src/core/camera.ts`, `src/core/camera.test.ts`
- Modify: `src/core/sim/playerSim.ts` (step the camera after the player every tick)

**Interfaces:**
- Produces: `interface CameraState { x: number; y: number; cx: number; cy: number; anchorY: number; lookX: number; lookDown: number; bounds: { x: number; y: number; w: number; h: number } }` (`x`, `y` = rounded top-left scroll; `cx`, `cy` = unrounded center), `createCamera(bounds, b: PlayerBody): CameraState` (snapped), `stepCamera(c: CameraState, b: PlayerBody): void`, `snapCamera(c: CameraState, b: PlayerBody): void`.
- M1 implements 01 §14.1–14.2 and §14.3 snapping. Camera zones, the 0.4 s bounds blend and shake come later (M3 arenas, M2 shake).

- [ ] **Step 1: Write the failing tests** (01 §14)

- Standing on flat ground the feet sit at screen y 220 (`b.y - c.y === 220`) once settled.
- A full jump does not move the camera vertically (air up-slack 80 px).
- Falling moves the camera down at once (anchor follows falls); `lookDown` reaches 64 when `vy ≥ 300`.
- Look-ahead approaches `clamp(vx * 0.35, -80, 80)` at 240 px/s; idle look-ahead is `facing * 24`.
- The view never leaves the level bounds: run the full test level left to right with random inputs (seeded by a fixed LCG inside the test); every tick `0 ≤ c.x ≤ widthPx - 640` and `0 ≤ c.y ≤ heightPx - 360`.
- Edge margins: the player box is never closer than 64 px to the left/right edge of the view, or 48 px to top/bottom, except where the bounds clamp wins.
- `snapCamera` places the camera with no smoothing.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(core): follow camera with look-ahead, slack and bounds"`

### Task 14: Determinism

**Files:**
- Create: `src/core/sim/determinism.test.ts`

**Interfaces:**
- Consumes: `PlayerSim`, `MOVEMENT_TEST`.

- [ ] **Step 1: Write the test** (Test checklist 30): generate a 10,000-tick input recording from a fixed-seed LCG inside the test (directions, jump, dash, attack1 with down); run it on two fresh `PlayerSim`s on `MOVEMENT_TEST`; `expect` the JSON of `body` and `camera` to be equal on every tick. Also run the same recording with ticks delivered through `FixedStepper` at 60 Hz and at 144 Hz frame times; final states are identical.
- [ ] **Step 2: Run** — it should PASS already; if it fails, find the non-determinism (iteration order, floats from wall-clock time) and fix it in the owning module.
- [ ] **Step 3: Commit** `git commit -m "test(core): movement is deterministic across runs and frame rates"`

### Task 15: Playable test scene, debug API, e2e

**Files:**
- Create: `src/game/input/devices.ts`, `src/game/scenes/MovementTestScene.ts`, `src/game/debug.ts`, `tests/e2e/movement.spec.ts`
- Modify: `src/main.ts` (use `MovementTestScene`), `tests/e2e/boot.spec.ts` (wait for the new scene)

**Interfaces:**
- Consumes: everything above.
- Produces (`src/game/debug.ts`), installed when `import.meta.env.DEV` or the URL has `?debug=1`:
  ```ts
  interface GameDebugApi {
    ready: boolean;
    tick(): number;
    body(): PlayerBody;              // a copy
    camera(): CameraState;           // a copy
    setManual(on: boolean): void;    // manual: the scene stops stepping by itself and ignores devices
    step(n: number, spec?: InputSpec): void;  // run n ticks holding `spec` (pressed on the first tick only)
  }
  ```
  `window.__game: GameDebugApi`.

- [ ] **Step 1: Implement the scene**
  - `devices.ts`: keyboard via `keydown`/`keyup` on `window` using `KeyboardEvent.code` and 07 §8.1's default keys (`KeyA`/`ArrowLeft` left, `KeyD`/`ArrowRight` right, `KeyW`/`ArrowUp` up, `KeyS`/`ArrowDown` down, `Space` jump, `ShiftLeft` dash, `KeyJ` attack1, `KeyK` attack2, the rest per the table), ignoring `repeat`; gamepad polled once per rendered frame per 07 §8.2 (standard mapping, buttons 6/7 held at value ≥ 0.5, left stick into `setStick`). On window `blur`, call `releaseAll()`.
  - `MovementTestScene`: build `PlayerSim` on `MOVEMENT_TEST`; each frame `FixedStepper.advance(delta / 1000)` ticks, each tick `sim.step(builder.build())`; copy `sim.camera` (rounded `x`, `y`) to the Phaser camera. Draw solid tiles as `#4a4f63` rectangles, one-way tiles as a 4 px `#8a90a8` strip at the tile top, background `#1d2030`. The player is a 12 × 28 (or 12 × 14) rectangle colored by state: ground `#e8e8f0`, air `#9ad0ff`, dash/slide `#ffd84a`, wallSlide `#7affb0`, ledgeClimb `#ff9a3c`, dive states `#ff5a5a`, crawl `#c08aff`, with a 3 px nose on the facing side.
  - With `?debug=1`: top-left text (Phaser default font is fine in M1): `state`, `vx`, `vy`, `pt`, `grounded`, `airDash`, `doubleJump`, and the dash cooldown remaining.
- [ ] **Step 2: Write `tests/e2e/movement.spec.ts`**
  ```ts
  test('a full jump in the real build peaks 56 px', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => (window as any).__game?.ready === true);
    await page.evaluate(() => { const g = (window as any).__game; g.setManual(true); g.step(30, {}); });
    const startY = await page.evaluate(() => (window as any).__game.body().y);
    const minY = await page.evaluate(() => {
      const g = (window as any).__game; let m = Infinity;
      for (let i = 0; i < 60; i++) { g.step(1, { jump: true }); m = Math.min(m, g.body().y); }
      return m;
    });
    expect(startY - minY).toBeGreaterThanOrEqual(55); expect(startY - minY).toBeLessThanOrEqual(57);
  });
  test('slides and crawls through the tunnel', ...)   // walk right until x ≈ 600; step(1, { moveX: 1, moveY: 1, dash: true }); step(150, { moveX: 1 });
                                                       // the slide (99 px) ends under the ceiling in `crawl`, crawling (80 px/s) carries on;
                                                       // assert body().x > 776 (out of the 640–768 px tunnel) and state is 'ground'
  test('screenshot of the test level', ...)          // save test-results/movement-level.png and test-results/movement-tunnel.png
  ```
- [ ] **Step 3: Run** `npm run typecheck && npm test && npm run test:e2e` — all pass. **Read every screenshot** and check the grey-box level, the player, and the tunnel look right.
- [ ] **Step 4: Play-test by hand in the dev server** if you can't, describe what the e2e tests verified instead.
- [ ] **Step 5: Commit** `git commit -m "feat(game): playable movement test scene with debug API"` and push.
- [ ] **Step 6: Hand-off to the user.** Send the screenshots. Tell them, in plain words: what to try (the 80 px ledge, the double-jump ledge, the slide tunnel, the wall-jump shaft, one-way platforms, the dash-jump pit), that the game only has grey boxes on purpose, and ask how the movement **feels** (too floaty? too fast? dash too short?). Point them to the link from Task 2 if Pages is set up. Feedback on feel goes to the design chat, which will update the numbers in the spec.

---

## Done when

- All tasks are checked, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` pass.
- Every test from 01's Test checklist that this milestone covers passes: 1–22, 28–30, 35, 41. The rest (spikes, water, ice, collapsing platforms, minecart, hit-stop, combat speed caps, Chilled, shake, death) belong to later milestones.
- The user has played (or seen) the test level and given feedback on the feel.

**Next plan:** `M2-combat-core.md` (written by the design chat after this milestone): seeded RNG, hit-stop, health and the hurt pipeline, the first two weapons (Greatsword, War Maul), Wolf and Bandit, flask, death and restart, camera shake.
