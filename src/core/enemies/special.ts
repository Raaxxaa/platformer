// Stage 1 enemy specials (04 §3 notes): leaps, attack moves, the Boar charge, shots and the Brute wave.
import type { GameWorld } from '../sim/gameWorld.ts';
import { ENEMY, ticks } from '../tuning.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { removeEnemyGroups, type AttackHooks } from './attack.ts';
import { supportAhead } from './body.ts';
import type { EnemyState } from './enemy.ts';
import { spawnEnemyProjectile } from './projectiles.ts';
import { greatBoarHooks } from './greatBoar.ts';
import { mountainAttackHooks } from './mountains.ts';
import { swampAttackHooks } from './swamps.ts';
import { guardianAttackHooks } from './guardians2.ts';


function fireShots(w: GameWorld, e: EnemyState): void {
  for (const s of e.ai.attack?.def.shots ?? []) {
    const def = ENEMY_PROJECTILES[s.projectile];
    if (!def) continue;
    for (const angle of s.angles) spawnEnemyProjectile(w, e, def, s.aim, angle);
  }
}

function dazeAfterWall(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack!;
  removeEnemyGroups(w, e);
  e.ai.cooldowns.set(a.def.id, ticks(a.def.cooldown));
  e.ai.attack = null;
  e.token = null;
  e.ai.state = 'engage';
  e.ai.gapTicks = 0;
  e.vx = 0;
  e.control = { type: 'dazed', ticks: ENEMY.BOAR_DAZE_TICKS };
  w.requestShake(ENEMY.BOAR_WALL_SHAKE.amplitude, ENEMY.BOAR_WALL_SHAKE.seconds);   // Boar: wall → dazed 1.2 s (04 §3)
}

/** The attack hooks for an enemy's running attack. */
export function attackHooks(e: EnemyState): AttackHooks {
  const def = e.ai.attack?.def;
  if (!def) return {};
  if (e.def.id === 'great_boar') return greatBoarHooks(e);
  const guardian=guardianAttackHooks(e);if(guardian)return guardian;
  const mountain = mountainAttackHooks(e);
  if (mountain) return mountain;
  const swamp=swampAttackHooks(e);if(swamp)return swamp;
  return {
    onActStart(w, en) {
      if (def.leap && 'vx' in def.leap) {
        en.vx = en.facing * def.leap.vx;
        en.vy = def.leap.vy;
        en.grounded = false;
      } else if (def.move) {
        en.vx = (en.facing * def.move.dist) / def.move.time;
      }
      fireShots(w, en);
    },
    onActTick(w, en) {
      const a = en.ai.attack!;
      if (def.leap) return a.t > 1 && en.grounded;                    // the leap (and its box) ends on landing
      if (def.move) {
        if (en.def.id === 'wild_boar' && def.id === 'charge') {
          if (en.hitWall) { dazeAfterWall(w, en); return true; }
          if (en.grounded && !supportAhead(w, en, en.facing)) return true;   // skid at a ledge, then Rec
        }
        en.vx = (en.facing * def.move.dist) / def.move.time;
      }
      return false;
    },
    onRecStart(_w, en) {
      en.vx = 0;
    },
  };
}
