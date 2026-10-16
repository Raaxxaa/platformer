// Blink (03 §11.3): an 8-way teleport through thin walls; 0.15 s of ability i-frames after.
import { teleport } from '../../player/teleport.ts';
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { linkedValue } from '../helpers.ts';

const A = ABILITY.blink;

registerAbility('blink', {
  start(w, c) {
    const b = w.body;
    let dx: number = c.input.moveX, dy: number = c.input.moveY;
    if (b.state === 'wallSlide' && (dx === 0 || dx === b.lastWallDir)) dx = -b.lastWallDir;
    if (dx === 0 && dy === 0) dx = b.facing;
    const d = linkedValue(c, c.row.distancePx as number);
    const diag = dx !== 0 && dy !== 0;
    const step = diag ? Math.round(d * A.diag) : d;
    const x0 = b.x, y0 = b.y;
    const bounds = w.camera.target;
    const r = teleport(b, w.grid, dx * step, dy * step, bounds);
    if (!r.ok || Math.hypot(r.dx, r.dy) < A.minMove) {
      b.x = x0; b.y = y0;                                    // fizzle: nothing moved, nothing spent
      return false;
    }
    w.health.abilityIframeTicks = Math.max(w.health.abilityIframeTicks, A.iframeTicks);
    if (b.state === 'wallSlide' || b.state === 'ground' && !b.grounded) b.state = 'air';
    return true;
  },
});
