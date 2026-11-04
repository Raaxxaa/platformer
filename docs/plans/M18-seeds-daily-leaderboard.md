# M18: Better Seeds, Daily Twists, Seed Challenge and an Online Leaderboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user said seeds feel too similar and wants the daily to matter:
1. **More variety per seed:** objects (Lucky Blocks, keys, chests, loot stands) have 2–3 possible spots and every section version has 2 enemy formations; the seed picks.
2. **A twist every day:** each daily gets one of 10 twists (always-buff Lucky Blocks, glass cannon, extra elites, double gold, Dragon day…).
3. **Seed challenge:** play any seed (or a past day) exactly like a daily, to practice for it.
4. **Online leaderboard** for the daily (top 10 on the result, top 50 per day).

**Spec:** `docs/spec/06-run-levels-save.md` **§8.10** (object spots, formations, draws), §8.7 (layout code), **§14.1** (daily twist, seed challenge), **§14.3** (leaderboard). M15 must be done first (the daily exists there).

**Starting point:** M15 on `main`. Merge `main` and `origin/claude/great-dijkstra-g00pcj` first.

## Before Task 5: the user sets up the leaderboard service (5 minutes)
Send the user these steps when you reach Task 5 (plain words):
1. Go to https://supabase.com, sign up (free), **New project** (any name, e.g. `rushblade`, any password, nearest region).
2. In the project: **SQL Editor** → paste the SQL below → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key, and paste both in the builder chat. (The anon key is meant to be public; the rules in the SQL protect the data.)

```sql
create table public.daily_scores (
  id bigint generated always as identity primary key,
  day text not null check (day ~ '^[0-9]{8}$'),
  name text not null check (name ~ '^[A-Za-z0-9_]{3,12}$'),
  ticks integer not null check (ticks between 6000 and 2000000),
  class text not null, weapon text not null, road text not null,
  assist boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index daily_scores_day_name on public.daily_scores (day, name);
alter table public.daily_scores enable row level security;
create policy "read scores" on public.daily_scores for select using (true);
create policy "add a score" on public.daily_scores for insert with check (true);
```

## Global Constraints
- All earlier constraints hold. **Old seeds keep their section versions** (the new draws come after the existing 25, 06 §8.10).
- Counts per stage never change (06 §8.2, §8.4, 05 §9.5): spots and formations only move things.
- Nothing but the 06 §14.3 fields leaves the device. With no Supabase URL configured, the game works exactly as before.

## Review Focus
1. **Seed stability:** the same seed gives the same versions, formations and spots on every device.
2. **Reachability:** every candidate spot is reachable within its detour limit; route bots check every spot.
3. **Leaderboard safety:** only finished official dailies, once; names validated; offline queue retries exactly one row.

---

### Task 1: Object spots and enemy formations (data and core)
- [ ] Level source: `spotGroup` on Lucky Blocks, keys, chests and loot stands with 2–3 spots each (the first is today's); formation `B` for every section version (same enemies per type, elites, packs; Stage 1 spacing rule 06 §8.6). Write them with the existing generators (`levels-src/*/gen_variants.py`).
- [ ] `assembleLevel` takes the formation and spot picks; the `layout` stream's extra draws (06 §8.10); layout code with formation letters.
- [ ] **Tests:** old seeds keep their versions; same seed → same picks; every spot and formation passes `validateLevel`, the per-version content check and a route bot (spot reachable within its detour limit). Over 10 000 seeds, each spot/formation is picked evenly (±2%).
- [ ] **Commit.**

### Task 2: Daily twists
- [ ] The 10 twists of 06 §14.1 as run modifiers (core), drawn from the `daily` stream (third draw). Shown on the Daily title row, the run start banner and the result.
- [ ] **Tests:** one per twist with its exact effect (e.g. `golden_hour`: 1000 Lucky Block rolls give only buffs; `heavy_pockets`: a 120-gold ability costs 180; `swift`: a Wolf's chase speed ×1.2; `dragon_day`: the Dragon is present in every seed).
- [ ] **Commit.**

### Task 3: Seed challenge
- [ ] Title → Daily → **Any seed**: type a seed or pick one of the last 30 days; it plays like a daily (kit, twist, layout from the seed), never official, its own best per seed in `save.seedBests` (last 50).
- [ ] **Tests and an e2e** (play a past day's seed, check the kit and twist match that day). **Commit.**

### Task 4: Share text update
- [ ] The share text (06 §14.1) adds the twist name, e.g. `RUSHBLADE Daily 2026-11-04 · Glass Cannon · Tank (War Maul) · Forest · 8:42.13 · 🟩🟩🟥🟩`. Test. **Commit.**

### Task 5: Online leaderboard
- [ ] Send the user the setup steps above; put their Project URL and anon key in `src/data/online.ts`.
- [ ] Name prompt, Settings toggle, sending the official finished daily once (06 §14.3), offline queue, `#rank of N` and the top 10 on the result, Title → Daily → **Leaderboard** (last 30 days, top 50, assisted runs in their own list).
- [ ] **Tests** with a fake server (unit) and an e2e with the requests mocked; one real request in the hand-off check (post a test score named `test_bot` on a past day, then tell the user how to delete it in Supabase's Table Editor).
- [ ] **Commit.**

### Task 6: Hand-off
- [ ] Run everything; push to `main`.
- [ ] Tell the user: seeds now also move chests, keys and Lucky Blocks and swap enemy formations; every daily has a twist; you can practice any seed or a past day; and the daily has an online leaderboard. Send screenshots of a daily result with the leaderboard and of two different seeds of the same section. Ask friends to play today's daily.
