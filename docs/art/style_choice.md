# Art style choice (ART13b)

## What the user picked

After seeing the four Round 1 versions of the Dragon fight (`sketch_test_compare.png`), the user answered with six reference pictures and "I want it to be like this":

| File | What it shows |
|---|---|
| `sketch/reference_01.png` | Dead Cells: a swamp boardwalk under giant trees, huge light shafts, glowing lanterns, a misty violet and gold palette |
| `sketch/reference_02.png` | Dead Cells: a night pond with a golden giant, a glowing turquoise pool, fireflies, a dark violet sky |
| `sketch/reference_03.png` | Three pixel-art scenes: a dark purple crypt, a teal cave with red trees, a rainy pagoda |
| `sketch/reference_04.png` | Owlboy: a bright sky, a floating island, a willow, a grassy graveyard, clean saturated pixel art |
| `sketch/reference_05.png` | A dark teal jungle: glowing fungi, moss-covered branches, hanging vines |
| `sketch/reference_06.png` | A green misty swamp with a big dragon (the closest match to the user's own Dragon sketch) |

The user's Dragon sketch (`sketch/user_sketch_01–03.png`) still sets the Dragon's shape: a long angular skull, a heavy brow, horns swept back, a spiky crest down an S-curved neck, an open jaw, and barbels.

## What that means (the art chat's reading, to confirm with the design chat)

- **Pixel art with clearly visible pixels, at about today's pixel size.** In these references a pixel is about 3 screen pixels on a 1080p screen, so the game can stay at **640 × 360 inside**. That is close to Round 1's "A Fine pixel" in spirit, but the pixels stay the current size, so no resolution change is needed.
- **Characters a little bigger than today.** In the references the hero is about 50 of 360 pixels tall; ours is 32. The Round 2 scenes draw the hero about 44 px tall. This would change the player's frame size and art only, not the hurtbox (a question for the design chat).
- **The look comes from light and depth, not from more pixels:**
  - many background layers that fade into a colored fog the further away they are;
  - big soft light shafts and glowing lights (lanterns, fireflies, torches, magic), with bloom;
  - one bold color mood per stage (gold and violet, teal and black, green fog, warm sunset, crimson);
  - dark foreground silhouettes framing the screen edges;
  - characters with strong dark outlines, a bright rim light from the scene's main light, and glowing eyes and accents so they always read against the background.
- **Readability rule:** the playfield (ground and platforms) and the characters are higher in contrast than the backgrounds, which stay soft and foggy.

## Next

Round 2: one scene per stage in this look (`stage_test_<stage>.png` at 1920 × 1080, plus phone size). After the user reacts, the design chat writes the full redraw plan and the spec changes (art style rules in 08, the hero's frame size).

## Round 3: one detailed example per stage

After the swamp was approved (`final_example_swamp_v2.png`, `tools/art/final_swamp.py`), the other four stages got the same treatment in `tools/art/final_stages.py`. Each has many distance planes, real light from one main source, near-camera framing and its own enemies. `final_examples_all.png` shows all five together.

| Stage | Mood (the user's words) | Light |
|---|---|---|
| Plains & Forest | "nice peaceful long fields sometimes farms forest" | sunny morning, sun upper right |
| Caves & Mountains | "like a hike: low dense green forest, not dark, then snow and bald mountains" | crisp midday, sun upper left |
| Dark Forest & Swamps | "foggy dark scary" | moon behind the trees |
| Enemy Kingdom | "just a medieval city" | sunset behind the town, lit windows |
| King's Castle | "just castle" | daylight through stained glass, torches |
