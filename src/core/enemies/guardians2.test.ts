import { describe, it, expect, vi } from 'vitest';
import { stepSpec } from '../testkit/combatWorld.ts';
import { startEnemyAttack, cancelEnemyAttack } from './attack.ts';
import { facePlayer, eligibleAttacks } from './ai.ts';
import { stepBossPhases } from './boss.ts';
import { damagePoise } from '../combat/enemyReactions.ts';
import { killEnemy, resolvePlayerHits, resolveEnemyHits, processDeaths, playerRect } from '../combat/resolve.ts';
import { spawnEnemyProjectile } from './projectiles.ts';
import { ENEMY_PROJECTILES } from '../../data/enemyProjectiles.ts';
import { newWeapon } from '../abilities/runtime.ts';
import { createGuardianState } from './guardians2.ts';
import { ENEMIES } from '../../data/enemies.ts';
import { gridFromRects } from '../level/build.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import type { EnemyId } from './types.ts';

function world(id: EnemyId) {
  const grid=gridFromRects(60,30,[{x0:0,y0:20,x1:59,y1:29,kind:'solid'},{x0:0,y0:0,x1:59,y1:0,kind:'solid'}]);
  const w=new GameWorld({grid,spawn:{x:200,y:320},stage:2,enemies:[{enemy:id,x:400,y:320,facing:-1}]});
  const e=w.enemies[0];e.dormant=false;e.aware=true;e.boss={arenaId:'boss2',introTicks:0,enraged:false};e.guardian=createGuardianState();
  w.arenas.set('boss2',{id:'boss2',kind:'boss',rect:{x:16,y:16,w:928,h:304},doorIds:[],entryDoorIds:[],exitDoorIds:[],maxWave:0,parTicks:0,waveIds:[],nextWaveTick:0,doorsOpenTick:0,lockedOnce:true});
  w.run.arenas.boss2={locked:true,wave:0,lockTick:0,cleared:false,clearTick:null};
  w.health.iframeTicks=99999;return {w,e};
}
function attack(w:GameWorld,e:GameWorld['enemies'][number],id:string){startEnemyAttack(w,e,e.def.attacks.find(a=>a.id===id)!);}

describe('Stage2 Guardian specials (04 §10.2–10.3)',()=>{
  it('loads exact Guardian HP, boss bars and all attack tables',()=>{
    expect(ENEMIES.stone_colossus?.boss?.bar).toMatchObject({marks:[.5],title:'Guardian of the Mountain'});
    expect(world('stone_colossus').e.hp).toBe(1530);expect(world('spider_queen').e.hp).toBe(1445);
    expect(ENEMIES.spider_queen?.boss?.bar.marks).toEqual([.66,.5,.33]);
  });
  it('Colossus turns after120 normal ticks or72 enraged, resets the wait and keeps its attack facing',()=>{
    const {w,e}=world('stone_colossus');w.body.x=500;
    for(let n=0;n<119;n++)facePlayer(w,e);expect(e.facing).toBe(-1);
    facePlayer(w,e);expect(e.facing).toBe(1);
    e.boss!.enraged=true;w.body.x=200;for(let n=0;n<71;n++)facePlayer(w,e);expect(e.facing).toBe(1);
    facePlayer(w,e);expect(e.facing).toBe(-1);
  });
  it('Rock Rain snapshots clamped five/seven markers at Tele start then drops16base rocks at Tele end',()=>{
    for(const enraged of [false,true]){
      const {w,e}=world('stone_colossus');e.boss!.enraged=enraged;w.body.x=40;attack(w,e,'rock_rain');
      const xs=w.rockMarkers.map(r=>r.x);expect(xs).toEqual((enraged?[-192,-128,-64,0,64,128,192]:[-128,-64,0,64,128]).map(dx=>Math.max(32,40+dx)));
      w.body.x=800;stepSpec(w,{},119);expect(w.projectiles).toHaveLength(0);expect(w.rockMarkers.map(r=>r.x)).toEqual(xs);
      stepSpec(w,{});expect(w.projectiles).toHaveLength(enraged?7:5);expect(w.projectiles.every(p=>p.def.hit.damage===16&&p.vy===420)).toBe(true);
    }
  });
  it('Leap Slam lands at the locked target after0.9s, keeps facing and releases impact plus both ranged waves only on landing',()=>{
    const {w,e}=world('stone_colossus');w.body.x=200;attack(w,e,'leap_slam');stepSpec(w,{},96);
    expect(e.vx).toBeCloseTo(-200/.9);expect(e.vy).toBeLessThan(0);expect(w.hitGroups.filter(g=>g.owner===e.id)).toHaveLength(0);
    w.body.x=600;stepSpec(w,{},106);expect(w.projectiles).toHaveLength(0);
    for(let n=0;n<4&&e.ai.attack?.phase!=='rec';n++)stepSpec(w,{});
    expect(e.ai.attack?.phase).toBe('rec');expect(e.x).toBeCloseTo(200,0);expect(e.facing).toBe(-1);
    expect(w.projectiles.map(p=>[p.vx,p.def.range,p.def.hit.damage])).toEqual([[-240,160,15],[240,160,15]]);
    expect(w.hitGroups.some(g=>g.owner===e.id&&g.kind==='melee'&&g.enemyHit?.damage===24)).toBe(true);
    stepSpec(w,{});expect(w.hitGroups.some(g=>g.owner===e.id&&g.kind==='melee')).toBe(false);
  });
  it('Queen climbs hittable for72 ticks, follows marker84 ticks, locks36, falls600 and lands into144tick Rec',()=>{
    const {w,e}=world('spider_queen');attack(w,e,'ceiling_drop');
    stepSpec(w,{},72);expect(e.y).toBe(16+36);expect(e.guardian!.marker?.x).toBe(200);
    w.body.x=500;stepSpec(w,{},84);expect(e.guardian!.marker?.x).toBe(500);
    w.body.x=700;stepSpec(w,{},35);expect(e.guardian!.marker?.x).toBe(500);expect(e.x).toBe(400);
    stepSpec(w,{});expect(e.x).toBe(500);expect(e.vy).toBe(600);expect(e.ai.attack?.phase).toBe('act');
    for(let n=0;n<70&&e.ai.attack?.phase!=='rec';n++)stepSpec(w,{});
    expect(e.ai.attack).toMatchObject({phase:'rec',len:144,t:0});expect(e.y).toBe(320);expect(e.guardian!.marker).toBeNull();
  });
  it('cancelled Ceiling Drop cannot leave marker or resume climbing after Break',()=>{
    const {w,e}=world('spider_queen');attack(w,e,'ceiling_drop');stepSpec(w,{},100);expect(e.guardian!.marker).not.toBeNull();
    cancelEnemyAttack(w,e);expect(e.guardian!.marker).toBeNull();
    const y=e.y;e.ai.gapTicks=999;stepSpec(w,{},10);expect(e.y).toBeGreaterThan(y);
  });
  it('cancelled or chilled Rock Rain cannot release rocks ahead of its Tele end',()=>{
    const {w,e}=world('stone_colossus');attack(w,e,'rock_rain');e.status.chill={left:1000,scale:.5};
    stepSpec(w,{},120);expect(e.ai.attack?.phase).toBe('tele');expect(w.projectiles).toHaveLength(0);
    cancelEnemyAttack(w,e);stepSpec(w,{},120);expect(w.rockMarkers).toHaveLength(0);expect(w.projectiles).toHaveLength(0);
  });
  it('both forced Broods survive one large hit during Break and run once each after Break',()=>{
    const {w,e}=world('spider_queen');e.hp=Math.floor(e.maxHp*.3);damagePoise(w,e,e.poise,false);stepBossPhases(w);
    stepSpec(w,{},239);expect(e.ai.attack).toBeNull();expect(e.guardian!.broodPending).toBe(2);
    stepSpec(w,{});expect(e.ai.attack?.def.id).toBe('brood');
    stepSpec(w,{},145);expect(e.ai.attack?.def.id).toBe('brood');expect(e.guardian!.broodPending).toBe(0);
    stepSpec(w,{},96);expect(w.enemies.filter(s=>s.summonOwner===e.id&&!s.dead)).toHaveLength(4);
  });
  it('directly spawned Spiderlings also have no rewards and dead Queen rain cannot spawn late',()=>{
    const {w,e}=world('stone_colossus');expect(w.spawnExtra({enemy:'spiderling',x:800,y:320,facing:-1}).noRewards).toBe(true);
    attack(w,e,'rock_rain');killEnemy(w,e);stepSpec(w,{},120);expect(w.projectiles).toHaveLength(0);
  });
  it('boss death animation lasts180 ticks and a Wind kill on a Spiderling never refunds dash',()=>{
    const {w,e}=world('spider_queen');killEnemy(w,e);expect(e.deathTicks).toBe(180);
    const child=w.spawnExtra({enemy:'spiderling',x:800,y:320,facing:-1});
    w.combat.slots[0]={...newWeapon('greatsword'),element:'wind'};w.body.dashReadyPt=999;w.body.airDashAvailable=false;
    const id=w.newId();w.hitGroups.push({id,owner:'player',kind:'shot',slot:0,rect:{x:790,y:300,w:20,h:20},spec:{damage:100,kb:[0,0],poise:0,hitStop:0,kind:'shot'},active:true,lastHitTick:new Map(),hitCount:new Map(),attackInstance:id});
    resolvePlayerHits(w);expect(child.dead).toBe(true);expect(w.body.dashReadyPt).toBe(999);expect(w.body.airDashAvailable).toBe(false);
  });
  it('a real rightward Leap Slam wave applies300,-260 knockback instead of the Great Boar wave values',()=>{
    const {w,e}=world('stone_colossus');attack(w,e,'leap_slam');stepSpec(w,{},96);w.body.x=300;
    for(let n=0;n<120&&e.ai.attack?.phase!=='rec';n++)stepSpec(w,{});
    w.health.iframeTicks=0;
    for(let n=0;n<100&&w.health.hp===100;n++)stepSpec(w,{});
    expect(w.health.hp).toBe(80);expect(w.body.vx).toBe(300);expect(w.body.vy).toBe(-260);
  });
  it('a killing player hit removes Queen and child attacks before enemy hit resolution on that tick',()=>{
    const {w,e}=world('spider_queen');w.health.iframeTicks=0;
    const child=w.spawnExtra({enemy:'spiderling',x:200,y:320,facing:1});child.summonOwner=e.id;
    const shot=spawnEnemyProjectile(w,e,ENEMY_PROJECTILES.venom_glob!,'facing',0,{x:200,y:310});
    w.hitGroups.find(g=>g.id===shot.groupId)!.rect=playerRect(w);
    const biteId=w.newId();w.hitGroups.push({id:biteId,owner:child.id,kind:'melee',rect:playerRect(w),spec:{damage:8,kb:[0,0],poise:0,hitStop:0,kind:'melee'},enemyHit:child.def.attacks[0].hit,active:true,lastHitTick:new Map(),hitCount:new Map(),attackInstance:biteId});
    const id=w.newId();w.hitGroups.push({id,owner:'player',kind:'shot',rect:{x:368,y:284,w:64,h:36},spec:{damage:10000,kb:[0,0],poise:0,hitStop:0,kind:'shot'},active:true,lastHitTick:new Map(),hitCount:new Map(),attackInstance:id});
    resolvePlayerHits(w);resolveEnemyHits(w);expect(w.health.hp).toBe(100);expect(child.dead).toBe(true);expect(w.projectiles).toHaveLength(0);
    processDeaths(w);expect(w.events.filter(e=>e.t==='bossDefeated')).toHaveLength(1);expect(w.run.stats.kills).toBe(1);
  });
  it('a completed boss move cannot repeat after Break expires its cooldown when another move is eligible',()=>{
    const {w,e}=world('stone_colossus');w.body.x=360;
    vi.spyOn(w.rng.enemyAI,'pickWeighted').mockImplementation(list=>list[0].item);
    attack(w,e,'fist_slam');
    for(let n=0;n<300&&e.ai.attack;n++)stepSpec(w,{});
    expect(e.ai.attack).toBeNull();damagePoise(w,e,e.poise,false);stepSpec(w,{},240);
    expect(e.ai.attack?.def.id).toBe('rock_rain');
  });
  it('Break stops an airborne Colossus rising, drops it to the floor and cancels its landing attack',()=>{
    const {w,e}=world('stone_colossus');attack(w,e,'leap_slam');stepSpec(w,{},110);expect(e.vy).toBeLessThan(0);
    damagePoise(w,e,e.poise,false);expect(e.vy).toBe(0);expect(e.ai.attack).toBeNull();
    stepSpec(w,{},100);expect(e.grounded).toBe(true);expect(e.y).toBe(320);expect(w.projectiles).toHaveLength(0);
  });
  it('Queen forces Brood once at66% and33% despite gap/CD, preserves current attack until free and limits ordinary Brood to<2',()=>{
    const {w,e}=world('spider_queen');e.hp=Math.floor(e.maxHp*.65);e.ai.gapTicks=999;e.ai.cooldowns.set('brood',999);
    stepBossPhases(w);stepSpec(w,{});expect(e.ai.attack?.def.id).toBe('brood');
    stepSpec(w,{},96);expect(w.enemies.filter(s=>s.summonOwner===e.id)).toHaveLength(2);
    stepSpec(w,{},48);e.ai.gapTicks=999;stepSpec(w,{});expect(e.ai.attack).toBeNull();
    e.hp=Math.floor(e.maxHp*.32);stepBossPhases(w);stepSpec(w,{});expect(e.ai.attack?.def.id).toBe('brood');
    stepSpec(w,{},96);expect(w.enemies.filter(s=>s.summonOwner===e.id)).toHaveLength(4);
    cancelEnemyAttack(w,e);e.ai.cooldowns.clear();expect(eligibleAttacks(w,e).some(a=>a.id==='brood')).toBe(false);
    w.enemies.filter(s=>s.summonOwner===e.id).slice(0,3).forEach(s=>s.dead=true);expect(eligibleAttacks(w,e).some(a=>a.id==='brood')).toBe(true);
  });
});
