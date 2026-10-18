// Pure HUD numbers (07 §4.2, §4.4, §4.5, §6.1). Drawing code calls these; tests check them against 07's checklist.
import { GRADE_MULT } from '../../core/combat/damage.ts';
import type { Grade } from '../../core/combat/types.ts';
import { WEAPON_MATCH_MULT } from '../../data/classes.ts';
import { TOP_HUD } from '../../data/stageUi.ts';
import type { PlayerStatusId } from '../../core/enemies/types.ts';

/** 07 §4.1 fill areas (px). */
export const HUD_FILL = { hp: 158, rush: 46, flask: 44, flaskFull: 1000, rushPerSeg: 100, rushMax: 300 } as const;

/** §4.2: `hp <= 0 ? 0 : max(1, round(158 × hp / maxHp))`. */
export const hpFillW = (hp: number, maxHp: number) => (hp <= 0 ? 0 : Math.max(1, Math.round((HUD_FILL.hp * hp) / maxHp)));

/** §4.4: segment k fill = floor(46 × clamp(value − 100k, 0, 100) / 100); blink at level 3. */
export function rushFills(value: number): { w: [number, number, number]; blink: boolean } {
  const seg = (k: number) => Math.floor((HUD_FILL.rush * Math.min(HUD_FILL.rushPerSeg, Math.max(0, value - HUD_FILL.rushPerSeg * k))) / HUD_FILL.rushPerSeg);
  return { w: [seg(0), seg(1), seg(2)], blink: value >= HUD_FILL.rushMax };
}

/** §4.5: floor(44 × min(fillTenths, 1000) / 1000). */
export const flaskFillW = (fillTenths: number) => Math.floor((HUD_FILL.flask * Math.min(fillTenths, HUD_FILL.flaskFull)) / HUD_FILL.flaskFull);

/** §6.1: round(100 × gradeMult × (matched ? 1.25 : 1.0)). */
export const weaponDmg = (grade: Grade, matched: boolean) => Math.round(100 * GRADE_MULT[grade] * (matched ? WEAPON_MATCH_MULT : 1));

export function cardDelta(newDmg: number, slotDmg: number): { text: string; tone: 'good' | 'bad' | 'dim' } {
  const d = newDmg - slotDmg;
  return d > 0 ? { text: `+${d}`, tone: 'good' } : d < 0 ? { text: `${d}`, tone: 'bad' } : { text: '=', tone: 'dim' };
}

/** The top-left HUD's view of the core (07 §4.15 subset; keys and statuses come with M5). */
export interface TopHudView {
  hp: number; maxHp: number;
  rush: number; rushVisible: boolean;
  flask: { charges: number; maxCharges: number; fillTenths: number; blocked: boolean; drinking: boolean };
  gold: number; keys: number;
  statuses: { id: PlayerStatusId; x: number; stacks: number | null }[];
}
export function topHudView(w: import('../../core/sim/gameWorld.ts').GameWorld): TopHudView {
  let x: number = TOP_HUD.status.x;
  const statuses: TopHudView['statuses'] = [];
  for (const id of TOP_HUD.status.order) {
    const active = w.playerStatus[id];
    if (!active) continue;
    statuses.push({ id, x, stacks: id === 'poisoned' ? w.playerStatus.poisoned!.stacks : null });
    x += id === 'poisoned' ? TOP_HUD.status.poisonStep : TOP_HUD.status.step;
  }
  return {
    hp: Math.max(0, w.health.hp), maxHp: w.health.maxHp,
    rush: w.rush.value, rushVisible: w.level?.kind !== 'village',
    flask: { charges: w.flask.charges, maxCharges: w.flask.maxCharges, fillTenths: w.flask.fillTenths, blocked: false, drinking: !!w.drinking && !w.drinking.sipped },
    gold: w.gold, keys: w.econ.keys,
    statuses,
  };
}
/** A class or hybrid color key (07 §3.3); 'none' = No Class. */
export type ClassColorKeyLike = import('../../core/abilities/types.ts').ClassId | import('../../core/abilities/types.ts').HybridId | 'neutral' | 'none';
