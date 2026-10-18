import { describe, expect, it } from 'vitest';
import { enemyDrawing } from './enemyFallback.ts';
import { arenaWorld } from '../../core/testkit/combatWorld.ts';

describe('enemy drawing under darkness (08 §10.2,04 §5)', () => {
  it('shows only bubbles for a submerged Zombie, then its body when waking', () => {
    const w = arenaWorld(), e = w.spawnExtra({ enemy: 'bog_zombie', x: 200, y: 320, facing: 1, submerged: true });
    const submerged = enemyDrawing(w, e);
    expect(submerged).toMatchObject({ hidden: true, bubble: true, glint: false, warning: false });
    e.swamp!.submerged = false;
    expect(enemyDrawing(w, e)).toMatchObject({ hidden: false, bubble: false });
  });
  it('keeps dark eye glints and Tele outlines above fog, with a ceiling thread for hanging spiders', () => {
    const w = arenaWorld(), e = w.spawnExtra({ enemy: 'giant_spider', x: 200, y: 200, facing: 1, hang: true });
    w.darkZones.push({ id: 1, x: 100, y: 0, w: 300, h: 320, lightRadius: 112 });
    e.ai.attack = { def: e.def.attacks[0], phase: 'tele', t: 1, len: 42, groupId: null, moved: 0, hitDone: false };
    expect(enemyDrawing(w, e)).toMatchObject({ hidden: false, glint: true, warning: true });
    expect(enemyDrawing(w, e).threadTop).not.toBeNull();
    e.dead = true;
    expect(enemyDrawing(w, e)).toMatchObject({ glint: false, warning: false, threadTop: null });
  });
});
