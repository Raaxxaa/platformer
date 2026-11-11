# M19: Review Round — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the design decisions from the independent review (`docs/review/REVIEW-2026-11.md` on branch `review/fixes`): a short Daily that people can actually finish, a clear first minute, touch controls that don't cover the action, readable hints, and a set of feel and fairness fixes.

**First:** merge `review/fixes` into `main` (4 bug fixes with tests) and do the reviewer's builder message (`docs/review/MESSAGES-2026-11.md` §1), including: `?debug=1` runs never set records or reach the leaderboard. Then this plan.

**Spec (all new text is marked M19):** 06 §14.1a (Daily Sprint, Weekly Run), §14.3 (leaderboard changes), §12.3–12.4 (arrival help, Basics and Advanced); 07 §4.1b (hint plates, build banner, dash cue, death-screen progress, speedrun info, grade letters), §8.6 (controls in the bars, idle opacity, Pause top-left); 04 §2.5 (can't-reach rule, teaching enemy), §10.1 (Great Boar HP and pillars); 09 §3, §6 (no forced wardrobe, `acc_trainer`).

**Art is on hold:** use simple shapes or reused frames for anything new (pillars, plates, the headband icon).

## Global Constraints
All earlier constraints. Old saves keep working (old `save.daily` entries stay readable as history). Seeds: the new `daily` draw for the stage comes first, so new dailies differ from old ones; that is intended.

## Tasks

### Task 1: Daily Sprint and Weekly Run
- [ ] Core and UI per 06 §14.1a: stage from the seed, practice preset loadout, best of the day; Weekly on the ISO-week seed; Seed challenge for both; share texts. Tests for each rule and both share texts.
- [ ] **Leaderboard:** the user runs this once in Supabase → SQL Editor (send it to them in plain words), then switch the client to `submit_score`:
```sql
alter table public.daily_scores add column if not exists kind text not null default 'daily' check (kind in ('daily','weekly'));
drop index if exists daily_scores_day_name;
create unique index daily_scores_kind_day_name on public.daily_scores (kind, day, name);
drop policy if exists "add a score" on public.daily_scores;
create or replace function public.submit_score(p_kind text, p_day text, p_name text, p_ticks int, p_class text, p_weapon text, p_road text, p_assist boolean)
returns void language sql security definer set search_path = public as $$
  insert into daily_scores (kind, day, name, ticks, class, weapon, road, assist)
  values (p_kind, p_day, p_name, p_ticks, p_class, p_weapon, p_road, p_assist)
  on conflict (kind, day, name) do update set ticks = excluded.ticks, class = excluded.class,
    weapon = excluded.weapon, road = excluded.road, assist = excluded.assist, created_at = now()
  where excluded.ticks < daily_scores.ticks;
$$;
grant execute on function public.submit_score to anon;
```
- [ ] Blocked-name list, the privacy sentence at the name prompt, boards for Daily and Weekly. **Commit.**

### Task 2: The first minute
- [ ] No wardrobe on first launch (09 §6); Home Village arrival hint, the arrow over the statues then the gate, name plates near objects (06 §12.3).
- [ ] Training Yard **Basics** (5 stations, then `Start your run` or `Advanced training →`) and the `acc_trainer` reward for all stations (06 §12.4). Rebuild the yard level and its doc.
- [ ] E2E: a brand-new save reaches Stage 1 in under 60 s of scripted input without opening any menu except the class pick. **Commit.**

### Task 3: Touch layout and hint plates
- [ ] Controls into the side bars, idle opacity 35%, Pause top-left on touch (07 §8.6). Screenshots on 844 × 390, 667 × 375 and 932 × 430.
- [ ] Hint and sign plates above the hero or post, the sound note at the top (07 §4.1b). **Read the screenshots. Commit.**

### Task 4: Feel and fairness
- [ ] The teaching Bandit (04 §2.5) in every Plains §2 version; the can't-reach rule with tests for a boar below and a bandit above the path.
- [ ] Great Boar +25% HP and the two pillars (04 §10.1); update the boss tests; a bot that stands and trades hits must now lose or take over 30 s.
- [ ] Dash-ready cue, build banner with sound and trim flash, death-screen progress, grade letters everywhere (07 §4.1b). **Commit.**

### Task 5: Speedrun info
- [ ] Sum of best, possible time save, the `Timer info` setting, the Input display option (07 §4.1b). Tests for the math. **Commit.**

### Task 6: Hand-off
- [ ] Run everything; push to `main`. Tell the user what changed in plain words with screenshots (new Daily, the first minute, phone layout, the Boar with pillars) and ask them to play today's Daily Sprint with friends.
