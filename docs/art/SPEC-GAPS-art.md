# Art spec gaps — questions for the design chat

The art chat may only write in `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`, so its questions live here instead of `docs/SPEC-GAPS.md`.

| # | Where | Question | What the art build does for now |
|---|---|---|---|
| 1 | `tools/build_assets.py` | 08 §3.1 says `palette.py` writes `src/data/palette.generated.ts`, but the art chat may not touch `src/`. Who writes that file? | Writes the same file to `tools/out/palette.generated.ts` (git-ignored, compiled by a test) and commits `public/assets/palette.json` with every ramp. A code chat can copy it into `src/data/` when it needs it. |
| 2 | `tools/art/village.py` (`LAYOUT`) | ART3 asks for a spot for the future character mirror (GAME_PLAN 4.5), but 06 §12.3 has no mirror object or tile x. Where does it go? | `mirror_spot` (empty wooden frame, 24 × 40) at Home Village tile x 25, the free gap between the Wizard statue (21) and the dummy (28). |
| 3 | `tools/art/village.py` (`DUMMY_ANIMS`) | Not a spec question, a note for the code chat: 08 §7.3 gives the training dummy only `idle` (1) and `hit` (3) in atlas `enemies_extra`. The enemy view (`src/game/art/artViews.ts`) treats any enemy with `<id>_idle` as having stagger/death too, so listing the dummy in `anims.json` makes hitting it throw ("reading 'frames'"). | The dummy frames are built into `public/assets/atlases/enemies_extra.png/.json`, but `training_dummy_idle` and `training_dummy_hit` stay out of `anims.json` until the view supports the dummy (plays `hit` when struck, no death) and loads `enemies_extra`. Then the art chat adds them back. |
