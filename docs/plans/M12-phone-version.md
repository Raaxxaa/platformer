# M12: Phone Version — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RUSHBLADE plays well on phones and tablets, from the same website:
- **touch controls**: a floating stick on the left, buttons on the right (with live weapon and ability icons and cooldowns), a context button for interacting, tap-to-use menus;
- **fills the phone screen** in landscape (fractional scaling on small screens);
- **installable** as an app from the browser ("Add to Home Screen"), full screen, works offline;
- **runs smoothly** on a mid-range phone (a "Low effects" mode on by default on touch devices).

Same game, same saves, same seeds: only input, scaling, menus and packaging change.

**Why a web app (PWA) and not an app-store app:** it works on Android and iPhone today from the existing GitHub Pages site, with no store accounts, fees or reviews. A store version (wrapping the same site with Capacitor) can come later if wanted; nothing in this plan blocks it.

**Spec:** `docs/spec/07-ui-hud-controls.md` **§8.6** (touch controls, scaling, settings), §8.5 (settings data), §7 (menus), §6 (popups); `docs/spec/00-README.md` (resolution and scaling, now with the §8.6 exception); `docs/spec/01-movement.md` §1.2 (input latching); `docs/spec/06-run-levels-save.md` §15 (settings saved).

**Starting point:** M11 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first. ART10 Part A draws the touch button art; use simple shapes until it lands.

## Global Constraints

- All earlier constraints hold. **Nothing in `src/core/` changes**: touch is just another device feeding `InputState`. Determinism tests stay green.
- The touch overlay is plain DOM in `src/ui/touch/` (no Phaser), so it stays crisp and finger-sized at any game scale.
- Desktop must look and play exactly as before (keyboard, gamepad, whole-number scaling above 2×). Existing e2e tests keep passing.
- No new npm dependencies unless unavoidable (the service worker and manifest are small hand-written files).

## Review Focus

1. **Missed or stuck inputs:** quick taps must register (latched like keys); lifting a finger must always release; multi-touch must never mix fingers up. Pinned in Task 1.
2. **Dash-jump and other combos on touch:** dash then jump within the buffer must work with one thumb hopping buttons. Pinned in Task 2.
3. **Desktop regressions:** the overlay never appears or blocks clicks on desktop with `Auto`.
4. **iPhone quirks:** audio unlock on first touch, no page scroll/zoom/double-tap zoom, safe areas (notch), standalone mode.

---

### Task 1: Touch input model (pure, tested)

**Files:** `src/ui/touch/touchModel.ts` + test (pure TypeScript, no DOM).

- [ ] **Tests first:**
  - the stick: center at the first touch point; `moveX` ±1 beyond `0.35r`, `moveY` ±1 beyond `0.5r`, 8 directions; release on lift;
  - buttons: a touch that starts inside a button's hit circle (radius + 0.15u) holds that action until it lifts, even if it slides off; sliding onto another button does nothing; overlapping hit areas pick the nearest center;
  - several fingers at once (stick + jump + attack);
  - the unit `u` and the button table of 07 §8.6 (positions and sizes), with Button size and left-handed mirroring;
  - the Interact button exists only while there is an interact target;
  - Pause: while the Pause button is held, `restart` is held (06 §6.2 restarts after 60 ticks = 0.5 s and draws its ring); if the finger lifts before that, it was a tap: `pause` is pressed on that tick and the restart hold resets.
- [ ] **Implement.** Output per frame: the same `{held, pressedEdges}` shape the keyboard device gives the 01 §1.2 latch.
- [ ] **Commit.**

### Task 2: The overlay and the device

**Files:** `src/ui/touch/TouchOverlay.ts`, `src/ui/touch/touch.css`, `src/game/input/devices.ts` (add `touch`), `index.html`.

- [ ] DOM overlay with pointer events (`pointerdown/move/up/cancel`, `touch-action: none`), one listener on the overlay, pointer ids tracked by the model.
- [ ] **Live icons:** Attack 1/2 show the weapon icons from the `ui` atlas (07 §4.8), Ability 1/2 the ability icons with the cooldown shade and charges (07 §4.9), Heal the flask with the charge count. Read from the HUD model, never from core internals.
- [ ] **Auto show/hide** by last device (07 §8.6), settings `On`/`Off`.
- [ ] **Prompt style `touch`** for in-game prompts (07 §8.4).
- [ ] **Page setup for phones:** viewport `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`; `overscroll-behavior: none`; no text selection, no long-press menu, no double-tap zoom; safe-area insets (`env(safe-area-inset-*)`) added to the button positions.
- [ ] **Audio unlock** on the first touch (same rule as the first key or click, 07).
- [ ] **Tests:** dash-jump with touch (dash pressed, then jump 0.1 s later → a dash-jump, 01); unit tests for the device merge (keyboard + touch held together).
- [ ] **Commit.**

### Task 3: Scaling and orientation

**Files:** `src/game/zoom.ts` (or wherever scaling lives) + test, the portrait overlay.

- [ ] **Fractional fit** on touch devices and whenever the whole-number scale would be below 2 (07 §8.6 "Phone screen scaling"); whole-number scaling unchanged otherwise. Nearest-neighbor stays on.
- [ ] **Portrait:** pause and show "Turn your phone sideways" (with a small rotating-phone drawing); resume when landscape.
- [ ] **Tests:** the scale chosen for 844 × 390 (phone), 1280 × 720 (desktop: 2×), 1024 × 768 (tablet); portrait pauses.
- [ ] **Commit.**

### Task 4: Menus and popups by tap

- [ ] Every menu (title, Home Village popups, pause and its tabs, settings, records, death screen, run summary, practice setup, shop prompts, stat pick, route choice, class pick, seed entry): tapping a row selects and confirms; a back arrow (top-left) does Back; settings sliders and toggles work by tap and drag.
- [ ] **Seed entry on a phone:** a tap opens the phone's keyboard (hidden HTML input), or an on-screen letter grid; your choice, as long as typing a seed works.
- [ ] Item card option rows can be tapped (07 §6.1); the shop altar "hold to sell" works by holding the Interact button.
- [ ] **Commit.**

### Task 5: Touch settings and layout editor

- [ ] **Settings** (07 §7.7, §8.5): Touch controls (Auto/On/Off), Touch opacity, Button size, Left-handed, Vibration, Effects (High/Low; default Low on touch devices), **Edit layout** (drag buttons, pinch to resize, Reset). Saved in `settings.touch` (06 §15: defaults for old saves).
- [ ] **Vibration** events (07 §8.6).
- [ ] **Low effects:** half the particles (VFX pool cap 128, ambient particles ≤ 12), darkness texture at half resolution, no screen-wide flashes. Gameplay identical.
- [ ] **Commit.**

### Task 6: Installable app (PWA)

**Files:** `public/manifest.webmanifest`, `public/sw.js`, a tiny Vite plugin or build script that writes the list of built files for the service worker, icons from ART10 (`public/assets/app/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`; a placeholder until ART10).

- [ ] **Manifest:** name "RUSHBLADE", `display: "fullscreen"`, `orientation: "landscape"`, theme and background `#0d0b14`, the icons, `start_url` and `scope` matching the GitHub Pages path (`/platformer/`).
- [ ] **Service worker:** pre-caches the built game (HTML, JS, assets, levels, audio) on install; cache-first for same-origin requests; a new version replaces the old cache and the game shows a small "Update ready — restart to update" toast (never reloads mid-run).
- [ ] **iPhone:** `apple-mobile-web-app-capable`, status bar style black, apple-touch-icon.
- [ ] **Tests:** the manifest is valid JSON with the right paths; the built file list includes every file in `dist/`; e2e: after one load, the game loads again with the network blocked (Playwright offline mode).
- [ ] **Commit.**

### Task 7: Phone e2e, performance check and hand-off

- [ ] **E2E** `tests/e2e/phone.spec.ts` with Playwright mobile emulation (`hasTouch`, `isMobile`, viewport 844 × 390 and 390 × 844):
  - title → Home Village → pick a class by tapping the statue's Interact button and the class pick rows → walk through the gate with the stick → fight in Stage 1 (taps on Jump, Attack, Dash) → pause and resume by tap → hold Pause to restart;
  - Training Yard stations 1–3 by touch;
  - portrait shows the turn-sideways screen;
  - screenshots of the overlay over Stage 1, the Home Village, the pause LOADOUT tab and the layout editor. **Read them.**
- [ ] **Performance:** with Low effects in the emulated phone, log frame times over a 60 s Stage 1 run; no frame should do more than 4 simulation ticks of catch-up on average (headless is software rendering, so treat this only as a smoke check). Note it in the hand-off.
- [ ] **Run everything; push to `main`;** check the site deploys.
- [ ] **Hand-off:** tell the user, in plain words, with screenshots:
  - "Open https://raaxxaa.github.io/platformer/ on your phone and turn it sideways. To install it like an app: in Chrome (Android) tap ⋮ → *Add to Home screen*; in Safari (iPhone) tap Share → *Add to Home Screen*. It then opens full screen and works offline."
  - Ask: are the buttons the right size and in the right place? Anything hard to press? How does it run on your phone (smooth or choppy)? Did friends manage the controls?

## Done when

All tasks are checked, all checks pass (desktop e2e unchanged, phone e2e new), the site installs as an app, and the user has played on a real phone.

**Next plan:** `M13-character-customization.md`.
