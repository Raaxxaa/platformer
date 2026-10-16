// Arenas (06 §9.1–9.3): lock, waves, clear, doors, camera zones. 06 §2.8 step 11.
import { setCameraBounds, type CameraBounds } from '../camera.ts';
import { addFlaskFill } from '../combat/flask.ts';
import { spawnEnemy, type EnemyState } from '../enemies/enemy.ts';
import type { LevelObject } from '../level/loadLevel.ts';
import type { GameWorld } from '../sim/gameWorld.ts';
import { ARENA, ENEMY } from '../tuning.ts';
import { COMBAT_ARENA } from '../../data/levelRules.ts';

/** Runtime data for one arena (rebuilt on every restart). */
export interface ArenaRt {
  id: string; kind: 'combat' | 'boss' | 'side';
  rect: CameraBounds;
  doorIds: string[]; entryDoorIds: string[]; exitDoorIds: string[];
  maxWave: number;
  parTicks: number;
  waveIds: number[];               // enemy ids of the current wave
  nextWaveTick: number;            // -1 = none pending
  doorsOpenTick: number;           // -1 = none pending
  lockedOnce: boolean;
}

export function buildArenas(w: GameWorld): Map<string, ArenaRt> {
  const out = new Map<string, ArenaRt>();
  const objs = w.level?.objects ?? [];
  for (const a of objs.filter((o) => o.type === 'arena')) {
    const id = String(a.props.id);
    const doors = objs.filter((o) => o.type === 'arena_door' && o.props.arena === id);
    const bodyId = (o: LevelObject) => String(o.props.id ?? `${o.type}#${o.id}`);
    const kind = String(a.props.kind) as ArenaRt['kind'];
    const par = a.props.parTime !== undefined ? Number(a.props.parTime) : COMBAT_ARENA.parTime[w.stage];
    out.set(id, {
      id, kind, rect: { x: a.x, y: a.y, w: a.w, h: a.h },
      doorIds: doors.map(bodyId),
      entryDoorIds: doors.filter((d) => d.props.role !== 'exit').map(bodyId),
      exitDoorIds: doors.filter((d) => d.props.role === 'exit').map(bodyId),
      maxWave: Math.max(0, ...w.waveSpawns.filter((s) => s.arena === id).map((s) => s.wave)),
      parTicks: Math.round(par * 120), waveIds: [], nextWaveTick: -1, doorsOpenTick: -1, lockedOnce: false,
    });
    w.run.arenas[id] = { locked: false, wave: 0, lockTick: -1, cleared: false, clearTick: null };
  }
  return out;
}

const inside = (r: CameraBounds, x0: number, y0: number, x1: number, y1: number) =>
  x0 >= r.x && y0 >= r.y && x1 <= r.x + r.w && y1 <= r.y + r.h;

function spawnWave(w: GameWorld, a: ArenaRt, wave: number): void {
  a.waveIds = [];
  for (const s of w.waveSpawns.filter((sp) => sp.arena === a.id && sp.wave === wave)) {
    const e = spawnEnemy(w, s);
    e.dormant = false;
    e.aware = true;
    e.ai.state = 'engage';
    e.spawnInTicks = ENEMY.SPAWN_IN_TICKS;
    e.waveArena = a.id;
    w.enemies.push(e);
    a.waveIds.push(e.id);
  }
  w.run.arenas[a.id].wave = wave;
  w.events.push({ t: 'arenaWave', arenaId: a.id, wave });
}

/** Lock: the first tick the player's hurtbox is fully inside (06 §9.1). Returns true on the lock tick. */
export function tryLock(w: GameWorld, a: ArenaRt): boolean {
  const st = w.run.arenas[a.id];
  if (a.lockedOnce || w.health.dead) return false;
  const b = w.body;
  if (!inside(a.rect, b.x - b.w / 2, b.y - b.h, b.x + b.w / 2, b.y)) return false;
  a.lockedOnce = true;
  st.locked = true;
  st.lockTick = w.tick;
  for (const id of a.doorIds) w.setBodyActive(id, true);
  w.events.push({ t: 'arenaLocked', arenaId: a.id });
  return true;
}

function stepCombatArena(w: GameWorld, a: ArenaRt): void {
  const st = w.run.arenas[a.id];
  if (tryLock(w, a)) spawnWave(w, a, 1);
  if (!st.locked) return;
  if (a.doorsOpenTick >= 0) {
    if (w.tick >= a.doorsOpenTick) {
      for (const id of a.doorIds) w.setBodyActive(id, false);
      a.doorsOpenTick = -1;
      st.locked = false;
    }
    return;
  }
  if (a.nextWaveTick >= 0) {
    if (w.tick >= a.nextWaveTick) { a.nextWaveTick = -1; spawnWave(w, a, st.wave + 1); }
    return;
  }
  const wave = a.waveIds.map((id) => w.enemies.find((e) => e.id === id)).filter((e): e is EnemyState => !!e);
  if (wave.some((e) => !e.dead)) return;
  if (st.wave < a.maxWave) {
    a.nextWaveTick = w.tick + ARENA.NEXT_WAVE_TICKS;
    return;
  }
  // Clear (06 §9.2).
  st.cleared = true;
  st.clearTick = w.tick;
  const clearTicks = w.tick - st.lockTick;
  const fast = clearTicks <= a.parTicks;
  addFlaskFill(w, fast ? ARENA.FILL_FAST : ARENA.FILL_SLOW);
  w.events.push({ t: 'arenaCleared', arenaId: a.id, clearTicks, fast });
  a.doorsOpenTick = w.tick + ARENA.DOORS_OPEN_TICKS;
}

/** Stuck rule: a wave enemy with its feet outside its arena for 3.0 s in a row goes back to its spawn (06 §9.2). */
function stepStuck(w: GameWorld): void {
  for (const e of w.enemies) {
    if (e.waveArena === null || e.dead) continue;
    const a = w.arenas.get(e.waveArena);
    if (!a) continue;
    const out = !(e.x >= a.rect.x && e.x < a.rect.x + a.rect.w && e.y > a.rect.y && e.y <= a.rect.y + a.rect.h);
    e.outsideTicks = out ? e.outsideTicks + 1 : 0;
    if (e.outsideTicks >= ARENA.STUCK_TICKS) {
      e.x = e.spawn.x; e.y = e.spawn.y; e.vx = 0; e.vy = 0; e.remX = 0; e.remY = 0;
      e.knockback = false;
      e.outsideTicks = 0;
    }
  }
}

/** The camera's active bounds: a locked arena, else an `always` zone holding the player, else the level (01 §14.3). */
export function cameraTarget(w: GameWorld): CameraBounds {
  for (const a of w.arenas.values()) if (w.run.arenas[a.id]?.locked && a.kind !== 'side') return a.rect;
  for (const z of w.level?.objects ?? []) {
    if (z.type !== 'camera_zone' || (z.props.mode ?? 'always') !== 'always') continue;
    if (w.body.x >= z.x && w.body.x < z.x + z.w && w.body.y - w.body.h / 2 >= z.y && w.body.y - w.body.h / 2 < z.y + z.h) return { x: z.x, y: z.y, w: z.w, h: z.h };
  }
  return { x: 0, y: 0, w: w.grid.widthPx, h: w.grid.heightPx };
}

export function stepArenas(w: GameWorld): void {
  for (const a of w.arenas.values()) if (a.kind === 'combat') stepCombatArena(w, a);
  stepStuck(w);
  setCameraBounds(w.camera, cameraTarget(w));
}
