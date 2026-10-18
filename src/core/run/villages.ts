// Village interactions and Home gate policy (06 §12). Scenes draw prompts and open menus.
import { classStatue } from '../abilities/items.ts';
import type { ClassId } from '../abilities/types.ts';
import { createRunState } from './runState.ts';
import { beginTransition } from './phases.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { buyFlaskUpgrade, buyKey, refill, rerollShop } from '../economy/shop.ts';

const SERVICES: Record<string, (w: GameWorld) => boolean> = { shop_flask: buyFlaskUpgrade, shop_refill: refill, shop_key: buyKey, shop_reroll: rerollShop };

export function setupVillage(w: GameWorld): void {
  for (const o of w.level?.objects ?? []) {
    if (o.type === 'ability_altar') w.interactables.push({ id: w.newId(), kind: o.type, label: String(Number(o.props.slot) - 1), x: o.x, y: o.y, use: () => {} });
    if (SERVICES[o.type]) w.interactables.push({ id: w.newId(), kind: o.type, label: o.type, x: o.x, y: o.y,
      use: (ww) => { const before = ww.events.length; if (!SERVICES[o.type](ww) && !ww.events.slice(before).some((e) => e.t === 'cantAfford')) ww.events.push({ t: 'cantAfford' }); } });
    if (o.type === 'class_statue') w.interactables.push(classStatue(w, o.props.cls as ClassId, o.x, o.y));
    if (['training_gate', 'seed_board', 'unlocks_board'].includes(o.type)) {
      const panel = o.type === 'training_gate' ? 'training' : o.type === 'seed_board' ? 'seed' : 'records';
      w.interactables.push({ id: w.newId(), kind: o.type, label: panel, x: o.w ? o.x + o.w / 2 : o.x, y: o.h ? o.y + o.h : o.y,
        w: o.w || undefined, h: o.h || undefined, use: (ww) => ww.events.push({ t: 'openHomePanel', panel }) });
    }
  }
}
export function stepVillage(w: GameWorld): void {
  if (w.level?.kind !== 'village') return;
  w.rush.value = 0; w.rush.stillTime = 0; w.rush.noGainTime = 0;
  w.villageMessage = null;
  if (w.run.phase !== 'homeVillage') return;
  const b = w.body;
  const gate = w.level.objects.find((o) => o.type === 'exit' && b.x + b.w / 2 > o.x && b.x - b.w / 2 < o.x + o.w && b.y > o.y && b.y - b.h < o.y + o.h);
  if (!gate) return;
  if (!w.run.startKit) { w.villageMessage = 'Choose a class at a statue first'; return; }
  const kit = w.run.startKit;
  w.run = createRunState(w.run.seedText, w.run.seeded); w.run.startKit = kit;
  beginTransition(w.run, 'homeGate', { phase: 'stage', levelId: 'plains', stage: 1 });
}
