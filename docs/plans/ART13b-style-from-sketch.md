# ART13b: Style Tests From the User's Sketch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user drew a sketch of how the game should look. They want **pixel art with very small pixels, or close to realistic**. Make **4 test versions of the same scene based on the sketch**, from "fine pixels" to "realistic", so the user can pick. Nothing in the game changes yet.

**Input:** the user's sketch **of the Dragon**, attached in the chat. Save it as `docs/art/sketch/user_sketch_01.png` (more as `_02`, …). Its shapes, proportions and mood come first.

**Two rounds:**
1. **Round 1 — pick the style:** one scene, **the Dragon fight** in its nest on the summit (06 §9.4: a cave with a wide opening to the sky), the Dragon drawn from the sketch, the hero mid-jump with the Greatsword, a fire breath telegraph, the HUD with the weapon/ability bar top-right. Draw it in the 4 versions below.
2. **Round 2 — every stage:** in the style the user picks (or their top 2, if they can't choose), one scene per stage, each with its own enemies and mood:
   - **Plains & Forest** (Stage 1): meadow and forest edge at morning, a Wolf pack and a Bandit Archer, the Great Boar's den behind;
   - **Caves & Mountains** (Stage 2): the icy climb with falling-rock warnings, a Ram and a Goblin Miner, the cave labyrinth's torches;
   - **Dark Forest & Swamps** (Stage 2): swamp water, a dark zone lit by fireflies, a hanging Giant Spider and a Swamp Witch;
   - **Enemy Kingdom** (Stage 3): town streets and rooftops, Soldiers, a Crossbowman, a cannon, the castle in the distance;
   - **King's Castle** (Stage 4): spike floors, a swinging blade, Royal Guards, a glimpse of the throne room.
   Every scene has the hero and the HUD, so they compare fairly.

## The 4 versions (smallest pixels to none)

| # | Name | What it means | Game resolution it needs |
|---|---|---|---|
| A | **Fine pixel** | Pixel art with pixels half the current size: hero about 64 px tall, rich shading, soft lights | 1280 × 720 inside (today 640 × 360) |
| B | **Tiny pixel (HD-2D)** | Pixels so small you only notice them up close: hero about 110 px tall, detailed textures, glow, depth fog, light rays. Like Octopath Traveler or Blasphemous 2 | 1920 × 1080 inside |
| C | **Realistic painted** | No visible pixels: smooth, detailed, painted-looking shading, realistic proportions and light | Full resolution, smooth scaling |
| D | **Mix** | Realistic painted backgrounds with tiny-pixel characters and effects in front (keeps characters crisp and readable) | 1920 × 1080 inside |

## Rules
- Only touch `tools/` and `docs/art/`. No game files change.
- Each version must stay **readable while playing fast**: hero and enemies stand out from the background, the Wolf's orange attack flash is easy to see, and it still reads on a phone screen (show each one also shrunk to 844 × 390).
- Make each version as good as it can be in its own style; not a filter over the current art.
- For each version, one plain line on **cost**: how much work redrawing the whole game would be, and what the code must change (higher inside resolution means bigger files and more work for phones).

## Tasks
- [ ] **Round 1:** `tools/art/style_test_sketch.py` draws the Dragon scene 4 times: `docs/art/sketch_test_A.png` … `_D.png` (1920 × 1080), plus a 4× close-up of the hero and the Wolf for each, plus a phone-size version of each.
- [ ] **Look at every image** with the Read tool and fix anything that doesn't match the sketch.
- [ ] Commit and push to `main` (only `tools/` and `docs/art/`).
- [ ] Show the user all 4 side by side next to their sketch, with one sentence each on what's different and the cost line. Ask which one they like, or which parts of which to mix, and anything they don't like. Write the answer in `docs/art/style_choice.md`.
- [ ] **Round 2:** the 5 stage scenes in the chosen style (`docs/art/stage_test_<stage>.png`, 1920 × 1080, plus phone size). Look at each, commit, push, and show the user all 5 together. Ask what to change. Then the design chat writes the full redraw plan.
