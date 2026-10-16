# Spec gaps — questions for the design chat

Build chats list here anything the spec didn't answer (or that looked wrong), what they chose for now, and where it lives in code (`// SPEC-GAP:`). The design chat answers and updates the spec; then the build follows.

| # | Where | Question | What the build does for now |
|---|---|---|---|
| 1 | `src/core/player/movement.ts` (`updateFacing`) | During the 14-tick wall-jump steering lock, does the player's facing follow the stick/keys, or stay pointed away from the wall? (It matters for a dash pressed with no direction held.) | Facing stays away from the wall until the lock ends. |
| 2 | `src/core/player/jump.ts` (`tryJump`, drop-through) | 01 §6.4 puts drop-through first in the jump priority with no state limit. So down + jump during a slide (or dash) on a one-way platform drops through it instead of doing a slide-jump — and players often still hold down during a slide. Is that wanted, or should drop-through only work from standing/crawling? | Follows the spec literally: it drops through (the slide or dash ends). |
| 3 | `src/core/camera.ts` (`stepCamera`) | The fall look-down (+64 px when falling at 300 px/s or more, 01 §14.1) also triggers at the end of every ordinary full jump, which lands at 400 px/s. So the camera dips a few pixels on each full jump. Is that wanted, or should look-down need a longer fall (e.g. only below the jump's start height)? | Follows the spec: the dip happens. The build plan's camera test was adjusted to "the camera doesn't move vertically while rising". |
