// Turret (03 §10.2): drops a ballista that shoots the nearest enemy in range for 8 s.
import { enemyCenter, enemyHittable } from '../../enemies/enemy.ts';
import type { GameWorld } from '../../sim/gameWorld.ts';
import { TICK, TILE_SIZE, ticks } from '../../tuning.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility, type ActivationCtx } from '../abilitySystem.ts';
import type { AbilityEntity } from '../entities.ts';
import { abilityHit, addAbilityGroup, lineOfSight, newInstance } from '../helpers.ts';

const A = ABILITY.turret;

export interface TurretEntity extends AbilityEntity { kind: 'turret'; x: number; y: number; vy: number; landed: boolean; airTicks: number; left: number; fireIn: number }

export function turrets(w: GameWorld): TurretEntity[] {
  return w.abilityEntities.filter((e): e is TurretEntity => e.kind === 'turret');
}

/** Is the 16 x 16 box standing on (x, feetY) inside a solid? */
function insideSolid(w: GameWorld, x: number, feetY: number): boolean {
  const h = A.size / 2;
  return [-h, h - 1].some((dx) => [-1, -A.size].some((dy) => w.grid.isSolidPx(Math.floor(x + dx), Math.floor(feetY + dy))));
}

function fireBolt(w: GameWorld, c: ActivationCtx, mx: number, my: number, tx: number, ty: number): void {
  const d = Math.hypot(tx - mx, ty - my) || 1, vx = ((tx - mx) / d) * A.boltSpeed, vy = ((ty - my) / d) * A.boltSpeed;
  const box = A.boltBox;
  const g = addAbilityGroup(w, c, abilityHit(c, 'bolt', c.row.boltDamage as number), { x: mx - box.w / 2, y: my - box.h / 2, w: box.w, h: box.h }, newInstance(w), { dir: vx < 0 ? -1 : 1 });
  let x = mx, y = my, flown = 0;
  g.onHit = (_ww, gg) => { gg.active = false; };                            // pierce 0
  w.abilityEntities.push({
    id: w.newId(), kind: 'turret_bolt',
    step: (ww) => {
      if (!g.active) return false;
      x += vx * TICK; y += vy * TICK; flown += A.boltSpeed * TICK;
      g.rect = { x: x - box.w / 2, y: y - box.h / 2, w: box.w, h: box.h };
      if (ww.grid.isSolidPx(Math.floor(x), Math.floor(y)) || flown >= A.boltRange) { g.active = false; return false; }   // vanishes on walls
      return true;
    },
  });
}

function placeTurret(w: GameWorld, c: ActivationCtx, x: number, feetY: number): void {
  const interval = ticks(c.row.fireIntervalS as number);
  const t: TurretEntity = {
    id: w.newId(), kind: 'turret', x, y: feetY, vy: 0, landed: false, airTicks: 0, left: ticks(A.lifeS), fireIn: ticks(A.firstShotS),
    step: (ww) => {
      t.left -= 1;
      if (t.left <= 0) return false;
      if (!t.landed) {
        t.vy = Math.min(t.vy + A.gravity * TICK, A.maxFall);
        const ny = t.y + t.vy * TICK;
        for (let py = Math.floor(t.y) + 1; py <= Math.floor(ny); py++) {
          if (ww.grid.isSolidPx(t.x, py) || ww.grid.isOneWayTopPx(t.x, py)) { t.y = Math.floor(py / TILE_SIZE) * TILE_SIZE; t.landed = true; break; }
        }
        if (!t.landed) { t.y = ny; t.airTicks += 1; if (t.airTicks >= ticks(A.fallLimitS)) return false; }   // never landed: vanishes
        return true;
      }
      if (t.fireIn > 0) t.fireIn -= 1;
      if (t.fireIn > 0) return true;
      const mx = t.x, my = t.y + A.muzzleDy;
      let best: { d: number; id: number; x: number; y: number } | null = null;
      for (const e of ww.enemies) {
        if (!enemyHittable(e)) continue;
        const ec = enemyCenter(e), d = Math.hypot(ec.x - mx, ec.y - my);
        if (d > A.range || !lineOfSight(ww, mx, my, ec.x, ec.y)) continue;
        if (!best || d < best.d || (d === best.d && e.id < best.id)) best = { d, id: e.id, x: ec.x, y: ec.y };
      }
      if (best) { fireBolt(ww, c, mx, my, best.x, best.y); t.fireIn = interval; }   // no target: the timer waits at ready
      return true;
    },
    view: () => ({ x: t.x, y: t.y, landed: t.landed, left: t.left }),
  };
  // Standing on the ground already: it has landed.
  if (w.grid.isSolidPx(x, feetY) || w.grid.isOneWayTopPx(x, feetY)) t.landed = true;
  w.abilityEntities.push(t);
}

registerAbility('turret', {
  effect(w, c) {
    const b = w.body, f = b.facing, n = c.row.turrets as number;
    const spots = n > 1 ? [b.x + f * A.offsetX, b.x - f * A.offsetX] : [b.x + f * A.offsetX];
    // SPEC-GAP: "max alive" with several turrets per cast: the oldest are removed first until the new ones fit.
    const live = turrets(w);
    const drop = live.length + spots.length - n;
    if (drop > 0) { const gone = new Set(live.slice(0, drop).map((t) => t.id)); w.abilityEntities = w.abilityEntities.filter((e) => !gone.has(e.id)); }
    for (const sx of spots) placeTurret(w, c, insideSolid(w, sx, b.y) ? b.x : sx, b.y);
  },
});
