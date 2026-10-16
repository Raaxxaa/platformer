# Art spec gaps — questions for the design chat

The art chat may only write in `tools/`, `public/assets/`, `docs/art/` and the `assets` line of `package.json`, so its questions live here instead of `docs/SPEC-GAPS.md`.

| # | Where | Question | What the art build does for now |
|---|---|---|---|
| 1 | `tools/build_assets.py` | 08 §3.1 says `palette.py` writes `src/data/palette.generated.ts`, but the art chat may not touch `src/`. Who writes that file? | Writes the same file to `tools/out/palette.generated.ts` (git-ignored, compiled by a test) and commits `public/assets/palette.json` with every ramp. A code chat can copy it into `src/data/` when it needs it. |
