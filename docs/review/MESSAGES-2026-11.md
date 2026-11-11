# Messages to paste, November 2026 review

Three messages, one per chat. Copy the text inside each box. The full reasoning and pictures are in [`REVIEW-2026-11.md`](REVIEW-2026-11.md); the item codes (C1, G15, P6…) point there.

---

## 1. For the builder chat (bugs and code work)

```
An independent review is in docs/review/REVIEW-2026-11.md. Please do the following, in this order.
Nothing here changes the design. If something needs a design answer, log a SPEC-GAP and keep going.

A. MERGE THE REVIEW FIXES FIRST
Branch: review/fixes (same commits are on claude/optimistic-ptolemy-2zynal). Four small fixes, each with a
test that failed first. Typecheck, 1,853 unit tests, build and all 256 browser tests pass on the branch.
  1. Touch prompts used characters the bitmap font does not have (empty boxes for Left, Up, Down, Pause).
     Files: src/ui/inputSettings.ts, src/ui/screens/settings.ts. Test: src/ui/fontCoverage.test.ts.
     Note: on touch, Pause now reads "PAUSE" and hold-to-restart "HOLD PAUSE".
  2. Training Yard signs now draw each key name as that action's glyph (keyboard, controller or touch).
     Files: src/ui/signParts.ts (new), src/game/scenes/StageScene.ts. Test: src/ui/signParts.test.ts.
  3. public/sw.js: cache lookups now pass ignoreVary, so the game starts offline on hosts that answer
     "Vary: Origin" (vite preview does). Test: src/pwa/sw.test.ts.
  4. The precache version now includes a content hash per file (it used name + size only, so a same-size
     change never produced an update). Files: src/pwa/precache.ts, vite.config.ts. Test: src/pwa/pwa.test.ts.

B. QUICK FIXES (about an hour each)
  1. Debug must not set records (C1). When ?debug=1 is on, mark the run so it writes no personal bests,
     no daily result, no boss rush best, and sends nothing to the leaderboard. Keep the debug API itself.
  2. Ask the browser to keep the save (C3): call navigator.storage.persist() after the first save. Inside the
     Capacitor app, also write the save through Capacitor's own storage and read it back if localStorage is empty.
  3. Crash panel (C4): add window "error" and "unhandledrejection" handlers that show a plain
     "Something went wrong — tap to reload" panel with the error text.
  4. Fix tests/e2e/pwa.spec.ts (C7): with Playwright 1.56.1, context.setOffline does not cut the service
     worker's own network, so the test passes even when the saved copy is not used. Stop the preview server
     in the test (or update Playwright and confirm the old sw.js fails).
  5. Make tests/e2e/phone.spec.ts:155 deterministic (C8): step the game by hand between touches instead of
     wall-clock waits. It failed once under load and passed when rerun.
  6. Run the browser tests in CI on pull requests (C6). Put layouts.spec.ts (6 minutes) in its own job.
  7. Update worker race (C11): stamp the version into sw.js at build time and use it in "activate" instead of
     fetching precache.json again.
  8. Boss Rush row on the title: say how to unlock it ("beat the King once") (G16).
  9. Home Village statue prompt: "Choose Swordsman" instead of the raw "swordsman" (G3). Also the class card's
     bottom hint line touches the frame.
 10. "Choose a class at a statue first" shows twice at the gate (red in the world and grey at the bottom).
     Show it once.
 11. Title screen: replace v0.0.0 with a real version or build date. Add a description and Open Graph tags to
     index.html so a shared link shows a title, a line and a picture (C12).
 12. Vibration on iPhone (P8): navigator.vibrate does not exist there. Use Capacitor Haptics in the app; hide
     the setting in Safari.
 13. Per-frame waste in WorldScene.render (C9): build the event list once per frame; read URL options once at
     start; do not JSON.stringify the light list every frame in darkness.ts.
 14. docs/plans/README.md still lists M15 and M18 as "Planned"; both are built.

C. MEDIUM WORK (about a day each)
  1. Smaller first download (P6). The loading screen fetches almost all 633 files (27 MB) before the title,
     then the service worker fetches them again with cache:"reload". Load the title, village and Stage 1 at
     start and the rest in the background or between stages; let the worker reuse the HTTP cache. Sounds
     (11 MB of WAV) need the art chat to export a compressed format first; then switch the file names.
  2. Swamp darkness (C5). src/game/view/darkness.ts recalculates a 640 × 360 mask per pixel on the CPU and
     uploads it every frame. With the CPU throttled 4× the render code averaged 20 ms in the swamp (5 ms in
     the plains). Draw each light as a soft sprite into a render texture with blending instead.
  3. Measure real frame rate on a real mid-range Android phone and an older iPhone, in the swamp and in the
     Stage 4 boss room (P10). The current phone "performance smoke" only checks that ticks advance.
  4. Check a 144 Hz monitor (G11). The scene draws the latest 120 Hz tick with no interpolation; if it
     stutters, blend between the last two ticks for drawing only.
  5. Update notice (P7): show "Update ready" as a row on the title screen that reloads when chosen.
  6. Replace window.prompt for the leaderboard name and "Any seed" with an in-game text box (G17).

D. KEEP IN MIND, NO RUSH
  - gameWorld.ts (1,002 lines), WorldScene.ts (771) and StageScene.ts (587) are hard to read; 164 lines in
    src/ are over 200 characters (C10). No rewrite. When a milestone touches one of these files, move one
    piece out and wrap the long lines you touch.

WAITING ON THE DESIGN CHAT (do not start yet): the first-minute flow, the touch layout, the short Daily,
enemies stuck on ledges, the dash-ready cue.
```

---

## 2. For the design chat (gameplay and design ideas)

```
An independent review is in docs/review/REVIEW-2026-11.md. These are its design recommendations. Please
decide each one and update the spec and plans; the builder is waiting on the ones marked BLOCKS.

MOST IMPORTANT

1. Make the Daily short (G15). BLOCKS.
   Today the Daily is a full 4-stage run, only the first attempt counts, and only a finished run goes to the
   leaderboard (06 §14.1, §14.3). A newcomer needs 25–35 minutes and will usually die, so the board stays
   empty and the people most likely to share never appear on it. Options:
     a) Daily = one stage (about 3 minutes), best time of the day counts. Recommended.
     b) Keep the full run but rank everyone: finishers by time, then deaths by how far they got.
   With (a), add a weekly full-run race on a fixed seed for experts.

2. The first 60 seconds (G1, G2, G6). BLOCKS.
   - "Play" opens the character creator before the player has moved. Suggest: start with the default hero;
     the village mirror invites them later.
   - The Home Village shows no instruction until the player walks to the gate. Suggest: a move hint on
     arrival, an arrow over the statues with "Choose your class", and a name over each object when near.
   - "Try the Training Yard first?" defaults to Yes and leads to 19 stations before the first enemy. Suggest:
     a short first visit (move, jump, dash, attack, heal) and the rest as "advanced", with a cosmetic reward
     for finishing them all.

3. Touch layout (P2, P3). BLOCKS.
   On phones the six buttons sit on the right third of the picture, where enemies enter. On 16:9 phones the
   pause button covers the ability slots; on wide phones 18% of the screen is black bars the controls only
   half use. Please decide:
     - On touch, should the hero sit further left so more road ahead is visible?
     - Controls fully inside the bars when bars exist?
     - May wide phones show more of the level, or must every device see the same 640 × 360 (fairness)?

4. Hint readability (G4).
   Hints and yard signs are the smallest, dimmest text on screen, at the bottom edge, with the sound note
   right under them. Suggest: a plate above the sign post or the hero, in a larger size.

FEEL AND FAIRNESS

5. Teach dash-through in Stage 1 (G7). A play-bot that only attacks and never dashes took 115–156 damage by
   the middle of Stage 1 (health is 100 plus two flasks of 40). The numbers are fair; the lesson comes late
   (yard station 11). Suggest a forced, safe dash-through at the first bandit.

6. The Great Boar (G8). A script that stood beside it and swung, with no healing, won in 22 seconds with
   8 health left. The plan says 30–60 seconds. Decide: gentle first boss on purpose, or should trading hits
   lose? One bot run, so please confirm with a real playtest.

7. Enemies stuck on height differences (G9). A boar two tiles below the path and a bandit two tiles above
   stayed "engaged" for 90 seconds without reaching the player. Decide: melee enemies drop small ledges, or
   give up and walk back.

8. Dash-ready cue on the hero (G10). Celeste shows dash state on the character. Suggest a flash or trim
   change when the dash returns.

9. Boss arenas (G12). The Great Boar's room is a flat box. Suggest one feature per boss room that changes the
   fight (something for the charge to crash into).

10. Make builds an event (G13). Getting a Connection bonus or a hybrid shows only as a name in the HUD
    corner. Suggest a banner, a sound and a trim change the moment it happens.

11. Progress on the death screen (G14). Keep "no permanent stats". Show collection progress after a death
    ("2 of 35 looks", "3 of 10 classes discovered") so a failed run still counts for something.

FOR SPEEDRUNNERS (pick what you like; see the table in section 2 of the review)
  - Sum of best and time-save per stage (Quick)
  - An input display option (Quick)
  - Splits per section, not only per stage (Medium)
  - Practice a single section from the pause menu (Medium)
  - Leaderboards per class and road, not only the Daily (Medium)
  - Share a ghost or replay as a code; later use it to check leaderboard times (Big)

LEADERBOARD HONESTY (C1, C2)
  - The builder will stop ?debug=1 runs from setting records. Please also decide: a blocked-word list for
    names, and one sentence of privacy text where the name is asked ("we store this name and your time").

STORY AND NAMES (needed for the store page)
  - Why the hurry? (The plan's own idea works: the King's army marches at dawn.)
  - Names for the King, his kingdom and the home village.
  - A tagline. Suggestion: "RUSHBLADE — Race to the King."
  - The user will first check that "Rushblade" is free on Steam, the App Store, Google Play and itch.io.

DEMO SCOPE (for the free web version)
  - Suggest Stage 1, one Stage 2 road and the Daily. Please decide what the demo contains and where it ends.
```

---

## 3. For the art chat (readability notes for the new style)

```
An independent review is in docs/review/REVIEW-2026-11.md. Art is on hold for the style pick (ART13), so
these are notes for the new style, plus one script change that does not depend on it. They are about
reading the game at speed, not about how pretty it is.

CAN BE DONE NOW (not style-dependent)

1. Compressed sound. The 338 sound effects are 11 MB of uncompressed WAV, most of the game's download.
   Please make the sound script also write a compressed version of each (the builder will tell you which
   format the game can load on iPhone and Android), aiming for about 1 MB in total.

2. Font characters. The bitmap fonts only hold a few symbols beyond letters: ← ↑ → ↓ ▸ ★ · × ± … —.
   Phone prompts needed ◂ ▴ ▾ and a pause symbol and drew empty boxes; the review replaced them with
   arrows and the word "PAUSE". When the fonts are redrawn, please add: a pause symbol, ◂ ▴ ▾, an en dash,
   and anything else the builder lists. src/ui/fontCoverage.test.ts shows what the game asks for.

FOR THE NEW STYLE: WHAT MUST READ IN A SPLIT SECOND

3. The hero against every background. The game is played at speed and on phones about 10 cm wide. In each
   of the four test styles, check the hero at phone size (the 640 × 360 picture shown 700 dots wide) on the
   brightest and the darkest part of every biome. An outline or a rim light that never changes is worth more
   than detail.

4. Enemy warnings. Today the whole enemy flashes near-white before an attack, and that works. Whatever the
   style, keep one warning language for every enemy (same color, same timing), and make sure a painted or
   soft style does not blur it.

5. Things you can touch versus scenery. In the Home Village the statues, mirror, dummy and boards look like
   decoration; nothing says "use me". In the new style give every usable object one shared signal (a glow, a
   bounce, a floating marker).

6. A dash-ready cue on the hero (if the design chat agrees): a short flash or a trim color change when the
   dash comes back. Speed players watch the hero, not the HUD.

7. Class and hybrid identity. Becoming a hybrid (for example Thunderlord) is the game's own idea, and today
   it shows only as a word in the HUD corner. Plan a clear trim or aura per class and hybrid that reads at
   phone size, and a banner for the moment it happens.

8. Hint and sign text. It is the smallest and dimmest text on screen. Plan a text plate style (dark plate,
   bright text, larger size) that sits above the sign post or the hero.

9. What sits under the touch buttons. On phones, six round buttons cover the lower right of the picture.
   Draw the touch buttons so they are see-through when idle, and keep important things (enemy warnings,
   projectiles) bright enough to read through them.

10. Loot grades by more than color. F, C, B, A, S are told apart by grey, green, blue, purple and gold.
    Add a shape or a letter that always shows, for players who cannot tell green from grey.

11. Boss rooms. If the design chat adds one feature per boss room, each needs to read as "this matters".

FOR THE STORE (after the style is picked)

12. A logo for RUSHBLADE and one key art picture (hero mid-dash, the King's castle behind, a clock motif).
13. Capture-friendly frames: screenshots and the trailer will be cut from real play, so check that a random
    paused frame of each biome looks good, not only posed scenes.
14. An idea for free attention: the four style test pictures can be posted as a public vote. If you can,
    make a clean side-by-side version without notes for that.
```
