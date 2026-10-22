# ART9 listening sheet: music

Listen to `docs/art/music_ART9.wav` (all 14 pieces in a row, about 3:11). Stage pieces start with only the beat and play two bars more of each layer (this is what happens as your Rush rises); boss pieces play 4 bars, then the extra intensity layers; stingers play in full. The game plays the same note data live (`public/assets/music/*.json`), so it sounds like this but loops forever.

| Track | Plays in | BPM | Bars | Loop length | Layers | Starts at | Mood |
|---|---|---|---|---|---|---|---|
| title | Title, menus, run summary | 96 | 16 | 40 s | base | 0:00 | Calm and a little sad: soft pad and strings with a slow bell tune in D minor. |
| village | All 4 villages | 80 | 16 | 48 s | base | 0:21 | Warm and safe: plucked guitar-like arpeggios, a gentle tune, no drums, F major. |
| plains | Stage 1 Plains | 132 | 32 | 58 s | L1 L2 L3 base | 0:46 | Fast and open: driving bass and beat, bright arpeggio and lead as your Rush climbs. |
| mountains | Stage 2 Mountain road | 126 | 32 | 61 s | L1 L2 L3 base | 1:02 | Rocky and tense: plucked strings over a steady stomp, E minor. |
| swamps | Stage 2 Forest road | 112 | 32 | 69 s | L1 L2 L3 base | 1:18 | Slow and murky: toms and low strings, a creeping C minor groove. |
| kingdom | Stage 3 Enemy Kingdom | 138 | 32 | 56 s | L1 L2 L3 base | 1:37 | Marching: snare drumline and brass stabs, G minor. |
| castle | Stage 4 King's Castle | 144 | 32 | 53 s | L1 L2 L3 base | 1:51 | Grand and ominous: strings, bell arpeggios, D harmonic minor. |
| boss_guardian | Great Boar, Stone Colossus, Spider Queen | 150 | 16 | 26 s | L1 base | 2:06 | Heavy fight music: galloping bass, toms, strings; the extra layer is the enraged form. |
| boss_black_knight | Black Knight | 156 | 32 | 49 s | L1 base | 2:20 | Armored duel: marching brass and fast gallop, C minor; extra layer in phase 2. |
| boss_king | Enemy King | 160 | 32 | 48 s | L1 L2 base | 2:33 | Royal and relentless: chugging strings, bells; two extra layers for phases 2 and 3. |
| boss_dragon | Dragon | 164 | 16 | 23 s | L1 base | 2:47 | The fastest and wildest: brass over a pounding chug, F# minor; extra layer in phase 2. |
| sting_victory | Boss defeated | 120 | 1 | 2 s | base | 2:59 | Short brass fanfare. |
| sting_death | You died | 96 | 1 | 2 s | base | 3:02 | Slow falling strings. |
| sting_complete | Run completed | 120 | 2 | 4 s | base | 3:06 | Longer triumphant fanfare with a held chord. |

**What to tell me:** which pieces feel wrong for their place (too busy, too sad, too similar), and whether the beat and bass are loud enough or too loud. Melodies are composed by a seeded generator over chord tones, so changing one only needs a number tweak in `tools/audio/music/tracks.py`.

Known limits: the sound is chip-tune and synth only (no real instruments); the preview is mono and has no panning or reverb.
