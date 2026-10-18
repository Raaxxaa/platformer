import { describe, it, expect } from 'vitest';
import { ENEMIES } from '../../data/enemies.ts';
import { arenaWorld, stepSpec } from '../testkit/combatWorld.ts';
import { cancelEnemyAttack, startEnemyAttack, stepEnemyAttack } from './attack.ts';
import { stepSwampSpecial, swampAttackHooks } from './swamps.ts';
import { stepEnemyBody } from './body.ts';
import { eligibleAttacks } from './ai.ts';
import { lightningChain } from '../combat/elements.ts';
import { applyBurn, spreadBurn, stepStatuses } from '../combat/status.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { processDeaths } from '../combat/resolve.ts';
import { resolvePlayerHits } from '../combat/resolve.ts';
import { enemyRect } from './enemy.ts';
import { newAbility, newWeapon } from '../abilities/runtime.ts';
function world(enemy: 'bog_zombie' | 'giant_spider' | 'wisp' | 'swamp_witch' | 'treant', x = 330, y = 320) {
  const w = arenaWorld({ stage: 2, enemies: [{ enemy, x, y, facing: -1 }] });
  w.health.iframeTicks = 99999;
  const e = w.enemies[0];
  e.dormant = false;
  e.aware = true;
  e.ai.state = 'engage';
  return { w, e };
}
describe('Dark Forest and Swamp enemy rules (04 §5)', () => {
  it('an unaware ghost Wisp notices through a solid wall at36ticks, then pursues', () => {
    const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, { x0: 16, y0: 0, x1: 16, y1: 19, kind: 'solid' }]);
    const w = new GameWorld({ grid, spawn: { x: 200, y: 320 }, stage: 2, enemies: [{ enemy: 'wisp', x: 300, y: 320, facing: 1 }] });
    const e = w.enemies[0];
    e.dormant = false;
    stepSpec(w, {}, 35);
    expect(e.aware).toBe(false);
    stepSpec(w, {});
    expect(e.aware).toBe(true);
    stepSpec(w, {}, 40);
    expect(e.x).toBeLessThan(300);
  });
  it('water halves ground movement, while waterWalker Zombies keep full speed', () => {
    const grid = gridFromRects(60, 23, [{ x0: 0, y0: 20, x1: 59, y1: 22, kind: 'solid' }, { x0: 0, y0: 19, x1: 59, y1: 19, kind: 'water' }]);
    const w = new GameWorld({ grid, spawn: { x: 200, y: 320 }, stage: 2, enemies: [{ enemy: 'goblin_miner', x: 300, y: 320, facing: 1 }, { enemy: 'bog_zombie', x: 400, y: 320, facing: 1, submerged: false }] });
    for (let n = 0; n < 120; n++)
      for (const e of w.enemies) {
        e.vx = 40;
        stepEnemyBody(w, e);
      }
    expect(w.enemies[0].x).toBe(320);
    expect(w.enemies[1].x).toBe(440);
  });
  it('Wisp stays alive for exactly12Actticks and self-death does not refund a real Blademaster dash', () => {
    const { w, e } = world('wisp', 200);
    w.setLoadout({ weapons: [newWeapon('greatsword'), null], abilities: [newAbility('whirlwind'), newAbility('blade_dash')] });
    expect(w.classState.bond).toBe('blademaster');
    w.body.dashReadyPt = 999;
    w.body.airDashAvailable = false;
    startEnemyAttack(w, e, e.def.attacks[0]);
    for (let n = 0; n < 84; n++)
      stepEnemyAttack(w, e, swampAttackHooks(e)!);
    expect(e.dead).toBe(false);
    expect(e.swamp?.detonating).toBe(true);
    const hp = e.hp;
    w.hitGroups.push({ id: w.newId(), owner: 'player', kind: 'melee', rect: enemyRect(e), spec: { damage: 9999, kb: [120, -40], poise: 9999, hitStop: 0, kind: 'melee' }, active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: w.newId(), slot: 0 });
    resolvePlayerHits(w);
    expect(e.hp).toBe(hp);
    expect(e.ai.attack?.phase).toBe('act');
    for (let n = 0; n < 11; n++)
      stepEnemyAttack(w, e, swampAttackHooks(e)!);
    expect(e.dead).toBe(false);
    stepEnemyAttack(w, e, swampAttackHooks(e)!);
    expect(e.dead).toBe(true);
    processDeaths(w);
    expect(w.body.dashReadyPt).toBe(999);
    expect(w.body.airDashAvailable).toBe(false);
  });
  it('interrupting RootSnare clears its target before the next BranchSlam box', () => {
    const { w, e } = world('treant');
    startEnemyAttack(w, e, e.def.attacks[0]);
    cancelEnemyAttack(w, e);
    expect(e.swamp!.marker).toBe(null);
    startEnemyAttack(w, e, e.def.attacks[1]);
    for (let n = 0; n < 78; n++)
      stepEnemyAttack(w, e, swampAttackHooks(e) ?? {});
    const g = w.hitGroups.find((g) => g.id === e.ai.attack?.groupId)!;
    expect(g.rect.x + g.rect.w / 2).toBe(e.x - 34);
    expect(g.box).toBeDefined();
  });
  it('secondary targeting skips submerged Zombies and secondary damage drops hanging Spiders harmlessly', () => {
    const w = arenaWorld({ stage: 2, enemies: [{ enemy: 'goblin_miner', x: 300, y: 320, facing: 1 }, { enemy: 'bog_zombie', x: 320, y: 320, facing: 1, submerged: true }, { enemy: 'giant_spider', x: 340, y: 320, facing: 1, hang: true }] });
    for (const e of w.enemies)
      e.dormant = false;
    const [source, zombie, spider] = w.enemies;
    const wisp = w.spawnExtra({ enemy: 'wisp', x: 360, y: 320, facing: 1 });
    wisp.swamp!.detonating = true;
    applyBurn(wisp, 10, 0, null);
    wisp.status.burn!.next = 1;
    lightningChain(w, source, 1, 20, () => 1, () => { });
    expect(zombie.hp).toBe(63);
    expect(spider.hp).toBeLessThan(49);
    expect(spider.swamp!.hanging).toBe(false);
    expect(spider.swamp!.harmlessDrop).toBe(true);
    expect(wisp.hp).toBe(35);
    applyBurn(source, 2, 64, null);
    spreadBurn(w, source);
    expect(zombie.status.burn).toBe(null);
    spider.swamp!.hanging = true;
    spider.swamp!.harmlessDrop = false;
    applyBurn(spider, 2, 0, null);
    spider.status.burn!.next = 1;
    stepStatuses(w);
    expect(spider.swamp!.hanging).toBe(false);
    expect(wisp.hp).toBe(35);
  });
  it('stores all five base definitions and exact Stage2HP', () => {
    const cases = [['bog_zombie', 45, 20, 4, 63], ['giant_spider', 35, 15, 4, 49], ['wisp', 25, 0, 3, 35], ['swamp_witch', 32, 10, 4, 45], ['treant', 170, 80, 20, 238]] as const;
    for (const [id, hp, poise, gold, scaled] of cases) {
      const { e } = world(id);
      expect(e.def).toMatchObject({ hp, poiseMax: poise, gold });
      expect(e.maxHp).toBe(scaled);
    }
    expect(ENEMIES.bog_zombie).toMatchObject({ waterWalker: true, preferred: [16, 32] });
    expect(ENEMIES.wisp).toMatchObject({ flying: true, ghost: true, noFacing: true, fly: 70, preferred: [0, 0] });
  });
  it('a hanging Spider needs below+LOS+40x; its Drop falls480 and lands into recovery', () => {
    const { w, e } = world('giant_spider', 200, 200);
    e.swamp!.hanging = true;
    e.aware = false;
    w.body.x = 245;
    expect(stepSwampSpecial(w, e)).toBe(true);
    expect(e.ai.attack).toBe(null);
    w.body.x = 200;
    expect(stepSwampSpecial(w, e)).toBe(true);
    expect(e.ai.attack?.def.id).toBe('drop');
    for (let n = 0; n < 42; n++)
      stepEnemyAttack(w, e, swampAttackHooks(e)!);
    expect(e.vy).toBe(480);
    for (let n = 0; n < 50 && e.ai.attack?.phase === 'act'; n++) {
      stepEnemyBody(w, e);
      stepEnemyAttack(w, e, swampAttackHooks(e)!);
    }
    expect(e.y).toBe(320);
    expect(e.ai.attack?.phase).toBe('rec');
  });
  it('Wisp flight is a70px/s line through solid walls and Detonate needs real center distance', () => {
    const { w, e } = world('wisp', 22, 200);
    stepSwampSpecial(w, e);
    expect(Math.hypot(e.vx, e.vy)).toBeCloseTo(70);
    e.x = 18;
    e.vx = -70;
    e.vy = 0;
    for (let n = 0; n < 50; n++)
      stepEnemyBody(w, e);
    expect(e.x).toBeLessThan(16);
    e.x = w.body.x + 20;
    e.y = w.body.y - 70;
    expect(eligibleAttacks(w, e)).toEqual([]);
    e.y = w.body.y;
    expect(eligibleAttacks(w, e).map((a) => a.id)).toContain('detonate');
  });
  it('Witch HexHop telegraphs36ticks, leaps backward, and is refused at a wall/ledge', () => {
    const { w, e } = world('swamp_witch', 230);
    expect(stepSwampSpecial(w, e)).toBe(true);
    expect(e.swamp!.reactionTicks).toBe(36);
    for (let n = 0; n < 36; n++)
      stepSwampSpecial(w, e);
    expect(e.vx).toBe(200);
    expect(e.vy).toBe(-300);
    expect(e.ai.cooldowns.get('hex_hop')).toBe(360);
    e.swamp!.reactionTicks = 0;
    e.swamp!.hopActive = false;
    e.grounded = true;
    e.ai.cooldowns.clear();
    e.x = 937;
    w.body.x = 915;
    expect(stepSwampSpecial(w, e)).toBe(false);
  });
  it('Treant stores its fixed RootSnare target at Tele start and uses144tick gap after Rec', () => {
    const { w, e } = world('treant', 330);
    startEnemyAttack(w, e, e.def.attacks.find((a) => a.id === 'root_snare')!);
    const target = { ...e.swamp!.marker! };
    w.body.x += 100;
    expect(e.swamp!.marker).toEqual(target);
    for (let n = 0; n < 96; n++)
      stepEnemyAttack(w, e, swampAttackHooks(e)!);
    const group = w.hitGroups.find((g) => g.id === e.ai.attack?.groupId)!;
    expect(group.rect.x + group.rect.w / 2).toBe(target.x);
    for (let n = 0; n < 102; n++)
      if (e.ai.attack)
        stepEnemyAttack(w, e, swampAttackHooks(e)!);
    expect(e.ai.attack).toBe(null);
    expect(e.ai.gapTicks).toBe(144);
  });
});
