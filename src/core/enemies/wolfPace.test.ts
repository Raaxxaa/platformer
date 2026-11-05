import { describe, expect, it } from 'vitest';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';

// M14 (04 §3): a Wolf in its 72–112 px band paces back and forth, always facing the player.
describe('Wolf pacing', () => {
  it('walks back and forth inside its band (turning within 0.6–1.0 s or at an edge), facing the player', () => {
    const w = arenaWorld({ seed: 7, enemies: [{ enemy: 'wolf', x: 290, y: 320, facing: -1 }] });
    const e = w.enemies[0]; e.dormant = false; e.aware = true; e.ai.state = 'engage';
    e.ai.cooldowns.set('leap', 1e9); for (const a of e.def.attacks) e.ai.cooldowns.set(a.id, 1e9);
    const dirs: number[] = [];
    for (let i = 0; i < 360; i++) {
      stepSpec(w, {});
      if (e.vx !== 0) dirs.push(Math.sign(e.vx));
      expect(e.facing).toBe(w.body.x >= e.x ? 1 : -1);
    }
    const turns = dirs.filter((d, i) => i > 0 && d !== dirs[i - 1]).length;
    expect(turns).toBeGreaterThanOrEqual(2);
    const dist = Math.abs(w.body.x - e.x); expect(dist).toBeGreaterThanOrEqual(60); expect(dist).toBeLessThanOrEqual(124);
  });
});
