import { STAGE2_LEVEL as S, LEVEL_RULES } from '../../data/levelRules.ts';
import { TILE_SIZE } from '../tuning.ts';
import { kindAt,type LevelData,type LevelObject } from './loadLevel.ts';

const contains=(o:LevelObject,x:number,y:number)=>x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.h;

/** Road-specific validation supplements the shared stage counts and movement lint. */
export function stage2Errors(d:LevelData):string[]{
  if(d.id!=='mountains'&&d.id!=='swamps')return [];
  const errors:string[]=[],id=d.id,rule=LEVEL_RULES[id];
  const sections=d.objects.filter(o=>o.type==='section');
  const inSection=(type:string,index:number)=>d.objects.filter(o=>o.type===type&&sections.some(s=>Number(s.props.index)===index&&contains(s,o.x,o.y-1)));
  for(const section of sections){
    const index=Number(section.props.index),expected=S.regulars[id][index-1];
    if(expected===undefined)continue;
    const count=d.objects.filter(o=>o.type==='enemy'&&Object.hasOwn(rule.regularMix,String(o.props.enemy))&&contains(section,o.x,o.y-1)).length;
    if(count!==expected)errors.push(`section ${index}: expected ${expected} regulars, found ${count}`);
  }
  if(id==='mountains'){
    const climb=sections.find(s=>Number(s.props.index)===3);
    const points=d.objects.find(o=>o.type==='main_path')?.points?.filter(p=>climb&&contains(climb,p.x,p.y))??[];
    const height=points.length?Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)):0;
    if(height<S.climb*TILE_SIZE)errors.push(`mountains: section 3 needs a main-path climb of at least ${S.climb} tiles`);
    if(inSection('falling_rocks',3).length===0)errors.push('mountains: section 3 needs falling_rocks');
    if(inSection('cracked_wall',4).length===0)errors.push('mountains: section 4 needs a cracked_wall skip');
    const section=sections.find(s=>Number(s.props.index)===6);
    let ice=false;
    if(section)for(let y=section.y/TILE_SIZE;y<(section.y+section.h)/TILE_SIZE;y++)for(let x=section.x/TILE_SIZE;x<(section.x+section.w)/TILE_SIZE;x++)ice ||= kindAt(d,x,y)==='ice';
    const carts=inSection('minecart',6),stops=inSection('minecart_stop',6);
    if(!ice||!carts.some(cart=>stops.some(stop=>stop.x-cart.x>=S.cartRun*TILE_SIZE)))errors.push(`mountains: section 6 needs ice and a minecart route of at least ${S.cartRun} tiles`);
  }else{
    for(const index of S.waterSections){
      const s=sections.find(s=>Number(s.props.index)===index);if(!s)continue;
      let water=0;
      for(let x=s.x/TILE_SIZE;x<(s.x+s.w)/TILE_SIZE;x++){
        let wet=false;
        for(let y=s.y/TILE_SIZE;y<(s.y+s.h)/TILE_SIZE;y++) {
          const below=kindAt(d,x,y+1);
          wet ||= kindAt(d,x,y)==='water'&&(below==='solid'||below==='ice'||below==='oneway');
        }
        if(wet)water++;
      }
      const fraction=water/(s.w/TILE_SIZE);
      if(fraction<S.waterFraction)errors.push(`swamps: section ${index} water covers ${(fraction*100).toFixed(1)}% of its floor length (min ${S.waterFraction*100}%)`);
    }
    for(const index of S.darkSections)if(!inSection('dark_zone',index).length||!inSection('firefly',index).length)errors.push(`swamps: section ${index} needs a dark_zone with a firefly`);
    if(!inSection('grapple_point',4).length)errors.push('swamps: section 4 needs a grapple_point skip');
  }
  for(const arena of d.objects.filter(o=>o.type==='arena'&&o.props.kind==='side')){
    if(arena.w!==S.sideWidth*TILE_SIZE||arena.h!==S.sideHeight*TILE_SIZE)errors.push(`side arena ${arena.props.id}: expected ${S.sideWidth}×${S.sideHeight} tiles`);
    if(!d.objects.some(o=>o.type==='dragon_warning'&&arena.x-o.x-o.w>=S.warningDistance))errors.push(`side arena ${arena.props.id}: warning must be at least ${S.warningDistance} px before its opening`);
  }
  return errors;
}
