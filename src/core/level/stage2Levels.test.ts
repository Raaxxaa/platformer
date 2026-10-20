import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadLevel, kindAt } from './loadLevel.ts';
import { validateLevel } from './validateLevel.ts';
import { routeLint } from './routeLint.ts';
import { GameWorld } from '../sim/gameWorld.ts';
import { stepSpec } from '../testkit/combatWorld.ts';
import { captureWorld } from '../run/session.ts';
import { openInn,chooseRoad } from '../run/roads.ts';
import { killEnemy } from '../combat/resolve.ts';
import crossroads from '../../../public/levels/village_crossroads.json';
import { RUN } from '../tuning.ts';

const read=(file:string)=>loadLevel(JSON.parse(readFileSync(new URL(`../../../public/levels/${file}.json`,import.meta.url),'utf8')));

describe('both Stage2 road maps and Border Village (06 §8–13)',()=>{
  it.each(['mountains','swamps'])('%s is built, valid, movement-legal and has the correct dormant Guardian',id=>{
    const data=read(id);expect(validateLevel(data)).toEqual([]);expect(routeLint(data)).toEqual([]);
    const w=GameWorld.fromLevel(data,{seedText:'ROAD'});expect(w.stage).toBe(2);
    expect(w.enemies.find(e=>e.boss)).toMatchObject({dormant:true,hp:id==='mountains'?1530:1445});
  });
  it('Border matches the shared48x23 service layout, mountains terrain and Stage3 shop odds',()=>{
    const data=read('village_border');expect([data.id,data.kind,data.biome,data.widthTiles,data.heightTiles]).toEqual(['border','village','mountains',48,23]);
    expect(validateLevel(data)).toEqual([]);
    const w=GameWorld.fromLevel(data,{seedText:'BORDER'});stepSpec(w,{});
    expect(w.shop?.villageIndex).toBe(2);expect(w.shop?.slots).toHaveLength(3);
    expect(data.objects.filter(o=>o.type==='shop_item').map(o=>o.x/16-.5)).toEqual([9,12,15]);
    expect(data.objects.filter(o=>o.type==='ability_altar').map(o=>o.x/16-.5)).toEqual([19,22]);
    for(let x=1;x<47;x++)expect(kindAt(data,x,20)).toBe('solid');
  });
  it.each(['mountain','forest'] as const)('%s carries the run through real road, second Guardian, stat choice and Border ending',road=>{
    const village=GameWorld.fromLevel(loadLevel(crossroads),{seedText:'CARRY'});
    village.setStartingKit({cls:'tank',weapon:'war_maul'});village.run.splits[0]=900;village.run.runTicks=1000;
    village.econ.goldTenths=1230;village.health.hp=17;village.flask.charges=0;village.flask.fillTenths=321;
    openInn(village);chooseRoad(village,road);stepSpec(village,{},RUN.FADE_TICKS);
    const stage=GameWorld.fromLevel(read(road==='mountain'?'mountains':'swamps'),{seedText:'CARRY',carry:captureWorld(village)});
    stage.completeLoading();stepSpec(stage,{},RUN.FADE_TICKS);
    expect(stage.run.phase).toBe('stage');expect(stage.run.runTicks).toBe(1120);expect(stage.run.stageTicks).toBe(0);
    expect(stage.run.road).toBe(road);expect(stage.gold).toBe(123);expect(stage.health.hp).toBe(100);expect(stage.flask).toMatchObject({charges:0,fillTenths:321});
    expect(stage.run.startKit).toEqual({cls:'tank',weapon:'war_maul'});
    const boss=stage.enemies.find(e=>e.boss)!;const arena=stage.arenas.get(boss.boss!.arenaId)!;
    stage.teleportPlayer(arena.rect.x+64,arena.rect.y+arena.rect.h);stepSpec(stage,{});
    expect(stage.run.arenas[arena.id].locked).toBe(true);killEnemy(stage,boss);
    const splitAt=stage.run.runTicks+1;stepSpec(stage,{});expect(stage.run.splits[1]).toBe(splitAt);
    stepSpec(stage,{},RUN.STAT_PICK_DELAY_TICKS);expect(stage.run.phase).toBe('statPick');
    stepSpec(stage,{},RUN.STAT_PICK_CONFIRM_TICKS);const stat=stage.statPick!.offer[0];expect(stage.confirmStatPick(0)).toBe(true);
    const exit=stage.level!.objects.find(o=>o.type==='exit')!;stage.teleportPlayer(exit.x+exit.w/2,exit.y+exit.h);stepSpec(stage,{});
    expect(stepSpec(stage,{},RUN.FADE_TICKS)).toContainEqual({t:'loadLevel',levelId:'border',stage:0});
    const border=GameWorld.fromLevel(read('village_border'),{seedText:'CARRY',carry:captureWorld(stage)});border.completeLoading();stepSpec(border,{},RUN.FADE_TICKS);
    expect(border.run.splits[1]).toBe(splitAt);expect(border.econ.statStacks[stat]).toBe(1);expect(border.shop?.villageIndex).toBe(2);
    expect(openInn(border)).toBe(true);expect(stepSpec(border,{},RUN.FADE_TICKS)).toContainEqual({t:'loadLevel',levelId:'kingdom',stage:3});
    expect(border.run.splits.slice(2)).toEqual([null,null]);
    expect(border.records.pbs).toEqual({});expect(border.events.some(e=>e.t==='runCompleted')).toBe(false);
  });
});
