import { describe, it, expect } from 'vitest';
import plainsJson from '../../../public/levels/plains.json';
import { loadLevel } from '../../core/level/loadLevel.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { runRouteBot } from '../../core/testkit/routeBot.ts';
import { formatTime } from '../../core/time.ts';

describe('Plains route bot (M3 Review Focus 1: no unbeatable geometry)', () => {
  it('walks, jumps, wall-jumps, slides and drops its way along the whole main path to the exit', () => {
    const w = GameWorld.fromLevel(loadLevel(plainsJson), { seedText: 'BOT' });
    const r = runRouteBot(w);
    console.log(`route bot: ${r.reached}/${r.total} vertices, ${formatTime(r.ticks)}`, r.log.join('\n'));
    expect(r.log).toEqual([]);
    expect(w.run.phase).toBe('transition');
    expect(w.run.transition?.target.levelId).toBe('crossroads');
  });
});
