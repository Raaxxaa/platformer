# ART8: waiting for the user (nothing here is approved yet)

The art chat never copies boards into `tools/approved/` and never edits `tools/approved/APPROVALS.md`. When you approve, a later chat copies the boards and logs them there.

## Boards to look at

| Board | File | What to check |
|---|---|---|
| Enemy Kingdom | `docs/art/style_board_kingdom_v1.png` | Stone brick terrain, banners and barrels, Soldier (shield), Crossbowman, War Hound, Battle Mage, Knight, Black Knight, cannon with muzzle glow and ball |
| King's Castle | `docs/art/style_board_castle_v1.png` | Dark stone with red carpet and gold trim, collapsing bridge, swinging blade on its chain, Royal Guard, Gargoyle (stone and awake), Castle Mage, Living Armor and its pile, Royal Executioner |
| Bosses | `docs/art/style_board_bosses_v1.png` | Black Knight, Enemy King, the Dragon in 4 colors with their breath cones |
| Weapons | `docs/art/style_board_weapons_v1.png` | The 11 new weapons mid-attack, javelin platform, rune ring |
| Contrast report | `tools/out/preview/contrast_report.txt` (rebuilt by `npm run assets`) | See the FAIL lines below |

## Contrast FAILs waiting for your decision (08 §12.8 check 5)

These pairs are below 0.15 OKLab distance because the palettes in 08 §3.7 are fixed. `tools/tests/test_contrast.py` skips them until you accept them in `tools/approved/APPROVALS.md` (code block under "Accepted contrast FAILs") or change the palette.

- Kingdom backdrop layers 0 and 1 (`bg_kingdom_0`, `bg_kingdom_1`) against the steel and black armor: Soldier, Crossbowman, War Hound, Knight, Black Knight (0.02 to 0.14).
- Player outfits against `terrain_kingdom`, `bg_kingdom_*`, `terrain_castle` and `bg_castle_*` (same story as the mountains, art gap #10).
- White Dragon against ice (`terrain_ice`, `bg_mountains_0`); Storm Dragon against `bg_mountains_1/2` and `bg_kingdom_0/1`.

## Not drawn / left for a code pass (see docs/art/SPEC-GAPS-art.md #19-#23)

- Crossbowman `aim` frames (drawn, not in `anims.json`), Dragon `wing_hop` (drawn, not in `anims.json`).
- Blade swoosh and Rune Ring / tome sounds are made but not yet triggered by the game.
- Phase 3 gold aura for the Enemy King; the decree guards reuse the Royal Guard.
