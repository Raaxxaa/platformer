# Art spec gaps — questions for the design chat

The art chat may only write in `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`, so its questions live here instead of `docs/SPEC-GAPS.md`.

| # | Where | Question | What the art build does for now |
|---|---|---|---|
| 1 | `tools/build_assets.py` | 08 §3.1 says `palette.py` writes `src/data/palette.generated.ts`, but the art chat may not touch `src/`. Who writes that file? | Writes the same file to `tools/out/palette.generated.ts` (git-ignored, compiled by a test) and commits `public/assets/palette.json` with every ramp. A code chat can copy it into `src/data/` when it needs it. |
| 2 | `tools/art/village.py` (`LAYOUT`) | ART3 asks for a spot for the future character mirror (GAME_PLAN 4.5), but 06 §12.3 has no mirror object or tile x. Where does it go? | `mirror_spot` (empty wooden frame, 24 × 40) at Home Village tile x 25, the free gap between the Wizard statue (21) and the dummy (28). |
