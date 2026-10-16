# Spec gaps — questions for the design chat

Build chats list here anything the spec didn't answer (or that looked wrong), what they chose for now, and where it lives in code (`// SPEC-GAP:`). The design chat answers and updates the spec; then the build follows.

| # | Where | Question | What the build does for now |
|---|---|---|---|
| 1 | `src/core/player/movement.ts` (`updateFacing`) | During the 14-tick wall-jump steering lock, does the player's facing follow the stick/keys, or stay pointed away from the wall? (It matters for a dash pressed with no direction held.) | Facing stays away from the wall until the lock ends. |
