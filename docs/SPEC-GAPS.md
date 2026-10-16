# Spec gaps — questions for the design chat

Build chats list here anything the spec didn't answer (or that looked wrong), what they chose for now, and where it lives in code (`// SPEC-GAP:`). The design chat answers and updates the spec; then the build follows.

| # | Where | Question | What the build does for now |
|---|---|---|---|
| 4 | `src/data/levels/combatTest.ts` (boar spawn) | The M2 plan wants the Wild Boar to have 200+ px of flat ground in front of it, but with the listed blocks it has 152 px to the low block (left) and 120 px to the tall wall (right). | Kept every position as listed. Either way a charge (270 px) ends in a wall, so you can still make it crash and get dazed. |
| 5 | `src/core/enemies/ai.ts` (stepEngage) | 04 §3 says the Wolf "backs off to its preferred band (72–112) and paces" after an attack. What does pacing look like (walk back and forth inside the band? how far, how fast)? | The Wolf backs off into its 72–112 px band and stands there, facing you, until its next attack. |
