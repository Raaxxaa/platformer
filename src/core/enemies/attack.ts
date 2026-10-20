// Running an enemy attack: Tele → Act → Rec, its hit group, cooldown and token (04 §2.6).
import { boxToWorld } from '../combat/hitGroups.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ticks } from '../tuning.ts';
import type { EnemyState } from './enemy.ts';
import type { EnemyAttackDef, EnemyHit } from './types.ts';
import { kingdomTeleTick } from './kingdom.ts';
import { castleTeleStart, castleTeleTick, cancelCastleAttack } from './castle.ts';
import { dragonTeleStart, dragonTeleTick, cancelDragonAttack } from './dragon.ts';
import { bossAttackGapTicks } from './boss.ts';
import { guardianTeleStart, cancelGuardianAttack } from './guardians2.ts';

export type ChainHit = NonNullable<EnemyAttackDef['chain']>[number];

/** The boss phase (1 or 2) an attack's `phases` filters use. */
export function bossPhase(e: EnemyState): number { return e.boss ? Math.max(e.boss.phase, e.boss.enraged ? 2 : 1) : 1; }

/** The hit, Act length and Move of the running link (04 §2.6 chains). */
export function currentLink(a: NonNullable<EnemyState['ai']['attack']>): { hit?: EnemyHit; active: number; move?: { dist: number; time: number } } {
  const k = a.link ?? 0;
  if (k === 0 || !a.chain) return { hit: a.def.hit, active: a.def.active, move: a.def.move };
  const c = a.chain[k - 1];
  return { hit: c.hit, active: c.active, move: c.move };
}

function setCooldown(e: EnemyState, def: EnemyAttackDef): void {
  e.ai.cooldowns.set(def.id, ticks(def.cooldown));
}

function gapTicks(e: EnemyState, def: EnemyAttackDef): number {
  return def.gapAfter !== undefined ? ticks(def.gapAfter) : bossAttackGapTicks(e) ?? ticks(e.def.attackGap);
}

export function removeEnemyGroups(w: GameWorld, e: EnemyState): void {
  w.hitGroups = w.hitGroups.filter((g) => !(g.owner === e.id && g.kind === 'melee'));
  if (e.ai.attack) e.ai.attack.groupId = null;
}

/** Starts an attack's telegraph: holds a token, locks facing, emits `enemyTelegraph`. */
export function startEnemyAttack(w: GameWorld, e: EnemyState, def: EnemyAttackDef): void {
  if(e.boss)e.boss.lastAttack=def.id;
  e.ai.attack = { def, phase: 'tele', t: 0, len: ticks(def.telegraph), groupId: null, moved: 0, hitDone: false,
    link: 0, chain: (def.chain ?? []).filter((c) => !c.phases || c.phases.includes(bossPhase(e))) };
  e.ai.state = 'attack';
  e.ai.t = 0;
  e.vx = 0;
  e.token = def.token === 'none' ? null : def.token;
  if(e.def.id==='treant'&&def.id==='root_snare')e.swamp!.marker={x:w.body.x,y:w.body.y};
  else if(e.def.id==='treant')e.swamp!.marker=null;
  guardianTeleStart(w,e);
  castleTeleStart(w,e);
  dragonTeleStart(w,e);
  w.events.push({ t: 'enemyTelegraph', enemyId: e.id, attackId: def.id, duration: def.telegraph });
}

/** The attack ends early (stagger, control, death): its cooldown starts as if used (02 §4.3). */
export function cancelEnemyAttack(w: GameWorld, e: EnemyState): void {
  const a = e.ai.attack;
  if (!a) return;
  cancelGuardianAttack(w,e);
  cancelCastleAttack(w,e);
  cancelDragonAttack(w,e);
  if(a.def.id==='root_snare'&&e.swamp)e.swamp.marker=null;
  removeEnemyGroups(w, e);
  setCooldown(e, a.def);
  e.ai.attack = null;
  e.token = null;
  e.ai.state = 'engage';
  e.ai.t = 0;
  e.ai.gapTicks = 0;
  if (e.knockback === false) e.vx = 0;
}

export function spawnAttackGroup(w: GameWorld, e: EnemyState, override?: EnemyHit): void {
  const a = e.ai.attack!;
  const hit = override ?? currentLink(a).hit;
  if (!hit) return;
  const marker=a.def.id==='root_snare'?e.swamp?.marker:null;
  const id = w.newId();
  a.groupId = id;
  w.hitGroups.push({
    id, owner: e.id, kind: 'melee', rect: boxToWorld(hit.box, marker?.x??e.x, marker?.y??e.y, e.facing),
    spec: { damage: hit.damage, kb: [0, 0], poise: 0, hitStop: 0, kind: 'melee', rehit: hit.rehit, maxHits: hit.maxHits },
    enemyHit: hit, box: marker ? undefined : hit.box, active: true, lastHitTick: new Map(), hitCount: new Map(), attackInstance: id,
  });
}

/** Hooks called by specials (moves, leaps, shots) at phase changes. */
export interface AttackHooks {
  deferHit?: boolean;
  untilLanding?: boolean;
  onActStart?(w: GameWorld, e: EnemyState): void;
  onActTick?(w: GameWorld, e: EnemyState): boolean;   // return true to end Act now
  onRecStart?(w: GameWorld, e: EnemyState): void;
  onRecTick?(w: GameWorld, e: EnemyState): void;
}

/** One enemy-time tick of the running attack. Returns true when the attack finished this tick. */
export function stepEnemyAttack(w: GameWorld, e: EnemyState, hooks: AttackHooks = {}): boolean {
  const a = e.ai.attack!;
  a.t += 1;
  if (a.phase === 'tele') {
    kingdomTeleTick(w, e);
    castleTeleTick(w, e);
    dragonTeleTick(w, e);
    if (a.t < a.len) return false;
    a.phase = 'act';
    a.t = 0;
    a.len = ticks(currentLink(a).active);
    if(!hooks.deferHit)spawnAttackGroup(w, e);
    hooks.onActStart?.(w, e);
    if (a.len > 0) return false;
  }
  if (a.phase === 'act') {
    const endNow = hooks.onActTick?.(w, e) ?? false;
    if (!e.ai.attack) return true;                       // the hook ended the attack (e.g. the Boar's wall daze)
    if (!endNow && (hooks.untilLanding || a.t < a.len)) return false;
    finishEnemyAct(w,e,hooks);
    return false;
  }
  hooks.onRecTick?.(w, e);
  if (a.t < a.len) return false;
  setCooldown(e, a.def);
  e.ai.attack = null;
  e.ai.state = 'engage';
  e.ai.t = 0;
  e.ai.gapTicks = gapTicks(e, a.def);
  return true;
}

/** Landing attacks finish after collision, so their impact is present on the landing tick. */
export function finishEnemyAct(w:GameWorld,e:EnemyState,hooks:AttackHooks):void {
  const a=e.ai.attack!;
  removeEnemyGroups(w,e);
  const next = a.chain?.[a.link ?? 0];
  if (next) {                                   // the next chained hit: its own short Tele, still committed
    a.link = (a.link ?? 0) + 1; a.phase = 'tele'; a.t = 0; a.len = ticks(next.telegraph); a.groupId = null;
    e.vx = 0;
    w.events.push({ t: 'enemyTelegraph', enemyId: e.id, attackId: a.def.id, duration: next.telegraph });
    return;
  }
  e.token=null;a.phase='rec';a.t=0;a.len=ticks(a.def.recovery);
  hooks.onRecStart?.(w,e);
}

/** Attached enemy melee boxes follow their owner (02 §2.2). */
export function syncEnemyGroups(w: GameWorld): void {
  for (const g of w.hitGroups) {
    if (typeof g.owner !== 'number' || g.kind !== 'melee' || !g.box) continue;
    const e = w.enemies.find((x) => x.id === g.owner);
    if (e) g.rect = boxToWorld(g.box, e.x, e.y, e.facing);
  }
}
