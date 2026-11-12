# ART13b: Style Tests From the User's Sketch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user drew a sketch of how the game should look. They want **pixel art with very small pixels, or close to realistic**. Make **4 test versions of the same scene based on the sketch**, from "fine pixels" to "realistic", so the user can pick. Nothing in the game changes yet.

**Input:** the user's sketch, attached in the chat. Save it as `docs/art/sketch/user_sketch_01.png` (and any more as `_02`, …) and follow it: its composition, shapes, character proportions and mood come first. Where the sketch doesn't say, use the ART13 test scene: Stage 1 Plains, the hero mid-jump with the Greatsword, a Wolf leaping, a Bandit Archer on a ledge, a Lucky Block, a key chest, the HUD with the weapon/ability bar top-right, one hit spark.

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
- [ ] `tools/art/style_test_sketch.py` draws the scene 4 times: `docs/art/sketch_test_A.png` … `_D.png` (1920 × 1080), plus a 4× close-up of the hero and the Wolf for each, plus a phone-size version of each.
- [ ] **Look at every image** with the Read tool and fix anything that doesn't match the sketch.
- [ ] Commit and push to `main` (only `tools/` and `docs/art/`).
- [ ] Show the user all 4 side by side next to their sketch, with one sentence each on what's different and the cost line. Ask which one they like, or which parts of which to mix, and anything they don't like. Write the answer in `docs/art/style_choice.md`. The design chat then writes the full redraw plan.
