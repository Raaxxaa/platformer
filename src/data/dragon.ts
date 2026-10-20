// The Dragon (04 §9.1, §13): four colors that differ in breath status, special, immunity and loot element.
import type { EnemyDef, EnemyHit, PlayerStatusId } from '../core/enemies/types.ts';
import { ENEMY, ticks } from '../core/tuning.ts';

export type DragonColor = 'red' | 'white' | 'storm' | 'green';
export const DRAGON_COLORS: readonly DragonColor[] = ['red', 'white', 'storm', 'green'];
export const DRAGON_NAME: Record<DragonColor, string> = { red: 'Red Dragon', white: 'White Dragon', storm: 'Storm Dragon', green: 'Green Dragon' };
export const DRAGON_ELEMENT = { red: 'fire', white: 'ice', storm: 'lightning', green: 'poison' } as const;
const STATUS: Record<DragonColor, { id: PlayerStatusId; stacks?: number } | undefined> = {
  red: { id: 'burning' }, white: { id: 'chilled' }, storm: undefined, green: { id: 'poisoned', stacks: 1 },
};
const SPECIAL_TELE: Record<DragonColor, number> = { red: 0.9, white: 0.8, storm: 0.8, green: 0.8 };

/** Three overlapping breath boxes (04 §13.1), as center offsets from the feet facing right. */
const BREATH = [{ dx: 56, dy: -16, w: 80, h: 32 }, { dx: 120, dy: -20, w: 80, h: 40 }, { dx: 184, dy: -24, w: 80, h: 48 }];
const WIDE = { minDY: -9999, maxDY: 9999 };

function breathHit(color: DragonColor): EnemyHit {
  const storm = color === 'storm', status = STATUS[color];
  return { box: BREATH[0], boxes: [BREATH[1], BREATH[2]], damage: storm ? 20 : 16, playerKb: [200, -120],
    ...(status ? { status } : {}), ...(storm ? {} : { rehit: 0.5, maxHits: 2 }) };
}

export function dragonDef(color: DragonColor): EnemyDef {
  return {
    id: 'dragon', tier: 'boss', elite: false, size: 'boss', hurtbox: { w: 72, h: 48 }, hp: 1000, poiseMax: 160, kbResist: 1.0,
    walk: 110, chase: 110, fly: 140, notice: { range: 9999, rangeY: 9999, time: 0 }, preferred: [64, 200], gold: 150,
    attackGap: 0.8, turnDelay: 0.6, itemRoll: 'none', blueprintRoll: true, hpBar: 'boss',
    boss: { breakTime: 2.5, breakMult: 1.25, attackGapEnraged: 0.6, enrageAt: 0.5, transition: true,
      bar: { name: DRAGON_NAME[color], title: 'Wandering Terror', marks: [0.5] } },
    attacks: [
      { id: 'breath', use: { minX: 64, maxX: 320 }, cooldown: 4.0, token: 'none', telegraph: 0.8, active: color === 'storm' ? 0.6 : 1.0, recovery: 0.8, hit: breathHit(color) },
      { id: 'claw_swipe', use: { minX: 0, maxX: 96 }, cooldown: 1.8, token: 'none', telegraph: 0.5, active: 0.12, recovery: 0.6,
        hit: { box: { dx: 52, dy: -20, w: 72, h: 40 }, damage: 20, playerKb: [300, -200] } },
      { id: 'tail_sweep', use: { minX: 0, maxX: 112, behind: true }, cooldown: 3.0, token: 'none', telegraph: 0.55, active: 0.12, recovery: 0.6,
        hit: { box: { dx: -60, dy: -12, w: 104, h: 24 }, damage: 18, playerKb: [340, -260] } },
      // Wing Gust: no damage; a push zone 200 x 80 in front (100, -40) while Act runs (0.8 s).
      { id: 'wing_gust', use: { minX: 0, maxX: 224 }, cooldown: 6.0, token: 'none', telegraph: 0.6, active: 0.8, recovery: 0.5 },
      { id: 'color_special', use: { minX: 0, maxX: 9999, ...WIDE }, cooldown: 10.0, token: 'none', telegraph: SPECIAL_TELE[color], active: color === 'white' ? 0.6 : 0.1, recovery: 0.5 },
      { id: 'dive_bomb', use: { minX: 0, maxX: 9999, ...WIDE }, cooldown: 6.0, token: 'none', telegraph: 0.5 + 1.1, active: ENEMY.LEAP_MAX, recovery: 1.0,
        hit: { box: { dx: 0, dy: -16, w: 128, h: 32 }, damage: 26, playerKb: [320, -260] } },
      { id: 'strafing_breath', use: { minX: 0, maxX: 9999, ...WIDE }, cooldown: 8.0, token: 'none', telegraph: 0.7, active: 3.0, recovery: 0.5,
        hit: { box: { dx: 0, dy: 52, w: 48, h: 104 }, damage: color === 'storm' ? 20 : 15, rehit: 0.4, maxHits: 2, ...(STATUS[color] ? { status: STATUS[color] } : {}) } },
    ],
  };
}

export const DRAGONS: Record<DragonColor, EnemyDef> = { red: dragonDef('red'), white: dragonDef('white'), storm: dragonDef('storm'), green: dragonDef('green') };

/** 04 §13 numbers. */
export const DRAGON = {
  hoverAbove: 104, hoverSpeed: 140, hoverOffset: 96, wallInset: 36,
  segmentTicks: ticks(8.0), takeoffTicks: ticks(0.6), transitionRiseTicks: ticks(1.0), fallSpeed: 400,
  passiveTicks: ticks(3.0), hopCooldownTicks: ticks(3.0), hopMinX: 120, hopDist: 160, hopVx: 400, hopVy: -300,
  gust: { zone: { dx: 100, dy: -40, w: 200, h: 80 }, accel: 5, cap: 240 },
  dive: { riseTicks: ticks(0.5), followTicks: ticks(0.8), lockTicks: ticks(0.3), speed: 700, marker: 128, waveSpeed: 300, waveRange: 160, waveDamage: 16, aboveTop: 80 },
  strafe: { speed: 260 },
  fireRain: { offsets: [0, -96, 96, -192, 192], puddle: { w: 48, h: 8, life: 3.0 } },
  ice: { first: 64, step: 64, delayTicks: ticks(0.15), activeTicks: ticks(0.15), w: 24, h: 48, damage: 18 },
  thunder: { w: 24, gapTicks: ticks(0.4), markerTicks: ticks(0.6), activeTicks: ticks(0.1), damage: 20 },
  toxic: { offsets: [0, -96, 96], w: 64, h: 48, drift: 30, lifeTicks: ticks(5.0), statusEveryTicks: ticks(0.5) },
} as const;
