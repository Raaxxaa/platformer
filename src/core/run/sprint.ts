// Daily Sprint and Weekly Run (06 §14.1a, M19). The Sprint is one stage, picked by the `daily` stream's first draw,
// then the class, weapon and twist draws; the Weekly is the full run on one seed per ISO week.
import { CLASS_IDS, CLASS_NAME, STARTING_KITS } from '../../data/classes.ts';
import { TWIST_NAME, TWISTS, type TwistId } from '../../data/twists.ts';
import { WEAPON_NAME } from '../../data/uiText.ts';
import type { ClassId } from '../abilities/types.ts';
import type { WeaponId } from '../combat/types.ts';
import { deriveSeed, fnv1a32, Rng } from '../rng.ts';
import { formatTime } from '../time.ts';
import type { StageLevelId } from '../../data/levelRules.ts';
import { dailyKit, dailyTwist, type DailyBook } from './daily.ts';

export const SPRINT_STAGES: readonly StageLevelId[] = ['plains', 'mountains', 'swamps', 'kingdom', 'castle'];
export const STAGE_TITLE: Record<StageLevelId, string> = { plains: 'Plains', mountains: 'Mountains', swamps: 'Swamps', kingdom: 'Kingdom', castle: 'Castle' };
export interface SprintPick { stage: StageLevelId; cls: ClassId; weapon: WeaponId; twist: TwistId }

/** r0 stage, r1 class, r2 weapon, r3 twist — all from stream `daily` (scope run). */
export function sprintPick(seedText: string): SprintPick {
  const rng = new Rng(deriveSeed(fnv1a32(seedText), 'daily', 'run'));
  const stage = SPRINT_STAGES[Math.floor(rng.next() * SPRINT_STAGES.length)];
  const cls = CLASS_IDS[Math.floor(rng.next() * 4)];
  const weapon = STARTING_KITS[cls].weapons[Math.floor(rng.next() * 2)];
  const twist = TWISTS[Math.floor(rng.next() * TWISTS.length)];
  return { stage, cls, weapon, twist };
}

/** Monday (UTC) of the ISO week holding `now`, as `YYYYMMDD`, and the ISO week label `2026-W46`. */
export function weekOf(now: Date): { monday: string; label: string } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;                      // Monday = 0
  const mon = new Date(d.getTime() - dow * 86_400_000);
  const thu = new Date(mon.getTime() + 3 * 86_400_000);    // ISO week-year = the Thursday's year
  const y = thu.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4)), week1 = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000);
  const week = 1 + Math.round((mon.getTime() - week1.getTime()) / (7 * 86_400_000));
  const p = (n: number) => String(n).padStart(2, '0');
  return { monday: `${mon.getUTCFullYear()}${p(mon.getUTCMonth() + 1)}${p(mon.getUTCDate())}`, label: `${y}-W${p(week)}` };
}
export const weeklySeed = (monday: string): string => `WEEKLY-${monday}`;
export const weeklyKit = (seed: string): { cls: ClassId; weapon: WeaponId; twist: TwistId } => ({ ...dailyKit(seed), twist: dailyTwist(seed) });

/** Best of the day/week (06 §14.1a): unlimited attempts, the lowest finished time counts. */
export function recordBest(book: DailyBook, key: string, ticks: number | null, keep: number, assist = false): { book: DailyBook; isNew: boolean } {
  const out: DailyBook = structuredClone(book);
  const e = out[key] ??= { official: null, bestTicks: null, attempts: 0 };
  e.attempts += 1;
  const isNew = ticks !== null && (e.bestTicks === null || ticks < e.bestTicks);
  if (isNew) { e.bestTicks = ticks; if (assist) e.bestAssist = true; else delete e.bestAssist; }
  const keys = Object.keys(out).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - keep))) delete out[k];
  return { book: out, isNew };
}

const date = (day: string) => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
/** `RUSHBLADE Daily 2026-11-12 · Mountains · Glass Cannon · Tank (War Maul) · 2:41.07` */
export function sprintShareText(day: string, p: SprintPick, ticks: number, assist: boolean): string {
  return `RUSHBLADE Daily ${date(day)} · ${STAGE_TITLE[p.stage]} · ${TWIST_NAME[p.twist]} · ${CLASS_NAME[p.cls]} (${WEAPON_NAME(p.weapon)}) · ${formatTime(ticks)}${assist ? ' (assist)' : ''}`;
}
