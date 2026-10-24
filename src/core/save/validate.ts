import { TOUCH } from '../../data/touch.ts';
import { classicLayout, LAYOUT, layoutCode, parseLayoutCode } from '../run/layout.ts';
import { migratePracticeKey } from '../run/practice.ts';
// Full save validation (06 §15). Keep good entries; default missing fields. No storage or clock reads.
import { ABILITY_INFO } from '../../data/abilities.ts';
import { BONDS, CLASS_IDS, HYBRIDS, STARTING_KITS, WEAPON_CLASSES } from '../../data/classes.ts';
import { ELEMENTS, GRADES, PERKS } from '../../data/loot.ts';
import { BLUEPRINT_IDS, defaultRunStats, defaultSave, SAVE_RULES as S, SAVE_STAGE_IDS, THIRD_START_WEAPON } from '../../data/save.ts';
import { RUN } from '../tuning.ts';
import type { AbilityId, BondId, ClassId, HybridId } from '../abilities/types.ts';
import type { WeaponId, WeaponInstance } from '../combat/types.ts';
import type { ActionId, KitSummary, PbKey, PbRecord, RunRecord, RunStats, SaveData, SettingsData } from './schema.ts';
import { migrateSave } from './migrate.ts';

type Obj = Record<string, unknown>;
const object = (raw: unknown): Obj => typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Obj : {};
const integer = (raw: unknown): raw is number => typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0;
const text = (raw: unknown): raw is string => typeof raw === 'string' && raw.length > 0;
const seed = (raw: unknown): raw is string => typeof raw === 'string' && raw.length > 0 && raw.length <= S.seedMaxLength && /^[A-Z0-9]+$/.test(raw);
const has = <T extends string>(values: readonly T[], raw: unknown): raw is T => typeof raw === 'string' && values.includes(raw as T);
const road = (raw: unknown): raw is 'mountain' | 'forest' => raw === 'mountain' || raw === 'forest';
const cls = (raw: unknown): raw is ClassId => has(CLASS_IDS, raw);
const weaponId = (raw: unknown): raw is WeaponId => typeof raw === 'string' && Object.hasOwn(WEAPON_CLASSES, raw);
const abilityId = (raw: unknown): raw is AbilityId => typeof raw === 'string' && Object.hasOwn(ABILITY_INFO, raw);
const unique = <T>(raw: unknown, check: (value: unknown) => value is T): T[] => Array.isArray(raw) ? [...new Set(raw.filter(check))] : [];
const pbKey = (raw: string): raw is PbKey => { const parts = raw.split('|'); return parts.length === 2 && cls(parts[0]) && road(parts[1]); };
const practiceKey = (raw: string): boolean => { const parts = migratePracticeKey(raw).split('|'); return parts.length === 3 && has(SAVE_STAGE_IDS, parts[0]) && cls(parts[1]) && parseLayoutCode(parts[2]) !== null; };

function isoDate(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) return false;
  // Parse only the supplied timestamp. No current date or wall clock is read.
  const value = Date.parse(raw); return Number.isFinite(value) && new Date(value).toISOString() === raw;
}
function startWeapon(classId: ClassId, raw: unknown, unlocked?: SaveData['unlocks']['startWeapons']): raw is WeaponId {
  return weaponId(raw) && (STARTING_KITS[classId].weapons.includes(raw)
    || raw === THIRD_START_WEAPON[classId] && (unlocked === undefined || !!unlocked[classId]?.includes(raw)));
}
function splits(raw: unknown, nullable: boolean): (number | null)[] | null {
  if (!Array.isArray(raw) || raw.length !== RUN.STAGE_COUNT) return null;
  let previous = 0, ended = false;
  for (const value of raw) {
    if (value === null && nullable) { ended = true; continue; }
    if (!integer(value) || ended || value < previous) return null;
    previous = value;
  }
  return [...raw];
}
function weapon(raw: unknown): WeaponInstance | null {
  const w = object(raw);
  if (!weaponId(w.weaponId) || !has(GRADES, w.grade) || !(w.element === null || has(ELEMENTS, w.element))
    || !(w.perk === null || typeof w.perk === 'string' && PERKS.some((perk) => perk.id === w.perk))) return null;
  return { weaponId: w.weaponId, grade: w.grade, element: w.element, perk: w.perk };
}
function kit(raw: unknown): KitSummary | null {
  const k = object(raw);
  if (!text(k.displayName) || !Array.isArray(k.weapons) || !Array.isArray(k.abilities) || k.weapons.length > S.kitSlots || k.abilities.length > S.kitSlots) return null;
  const weapons: KitSummary['weapons'] = [], abilities: KitSummary['abilities'] = [];
  for (const value of k.weapons) {
    if (value === null) weapons.push(null);
    else { const item = weapon(value); if (!item) return null; weapons.push(item); }
  }
  for (const value of k.abilities) {
    if (value === null) abilities.push(null);
    else {
      const item = object(value);
      if (!abilityId(item.id) || !integer(item.level) || item.level < 1 || item.level > S.abilityMaxLevel) return null;
      abilities.push({ id: item.id, level: item.level });
    }
  }
  return { displayName: k.displayName, weapons, abilities };
}
function runStats(raw: unknown, strict = false): RunStats | null {
  const source = object(raw), result = defaultRunStats();
  for (const key of Object.keys(result) as (keyof RunStats)[]) {
    if (integer(source[key])) result[key] = source[key];
    else if (strict) return null;
  }
  return result;
}
function personalBest(raw: unknown): PbRecord | null {
  const p = object(raw), times = splits(p.splits, false), gear = kit(p.kit);
  if (!integer(p.ticks) || !times || p.ticks !== times.at(-1) || !isoDate(p.date) || !seed(p.seedText) || !gear) return null;
  return { ticks: p.ticks, splits: times as PbRecord['splits'], date: p.date, seedText: p.seedText, kit: gear };
}
/** 06 §15.2: a missing or bad layout code (saves before M11) is the classic layout. */
function layoutField(raw: unknown): RunRecord['layout'] {
  const o = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  return Object.fromEntries(LAYOUT.stages.map((s) => [s, typeof o[s] === 'string' && parseLayoutCode(o[s] as string) ? o[s] : layoutCode(classicLayout())])) as RunRecord['layout'];
}
function runRecord(raw: unknown): RunRecord | null {
  const h = object(raw), times = splits(h.splits, true), gear = kit(h.kit), stats = runStats(h.stats, true);
  if (!isoDate(h.date) || !cls(h.startClass) || !startWeapon(h.startClass, h.startWeapon) || !(h.road === null || road(h.road))
    || !seed(h.seedText) || typeof h.seeded !== 'boolean' || !has(['complete', 'death', 'restart', 'quit'], h.result)
    || !integer(h.stageReached) || h.stageReached < 1 || h.stageReached > RUN.STAGE_COUNT || !integer(h.sectionReached) || h.sectionReached > S.maxSection
    || !integer(h.runTicks) || !times || times.some((tick) => tick !== null && tick > (h.runTicks as number))
    || !(h.cause === null || text(h.cause)) || !has(['absent', 'skipped', 'escaped', 'killed'], h.dragon) || !gear || !stats) return null;
  if ((h.result === 'restart' || h.result === 'quit') && h.runTicks < S.historyMinTicks) return null;
  if (h.result === 'complete' && (h.road === null || h.stageReached !== RUN.STAGE_COUNT || times.includes(null) || h.runTicks !== times.at(-1))) return null;
  return { date: h.date, startClass: h.startClass, startWeapon: h.startWeapon, road: h.road, seedText: h.seedText, seeded: h.seeded,
    result: h.result, stageReached: h.stageReached as RunRecord['stageReached'], sectionReached: h.sectionReached, runTicks: h.runTicks,
    splits: times, cause: h.cause, dragon: h.dragon, kit: gear, stats, layout: layoutField(h.layout) };
}

const fixedKey = (code: string) => /^(?:Escape|Tab|MetaLeft|MetaRight|ContextMenu|PrintScreen|F(?:[1-9]|1[0-2]))$/.test(code);
const keyCode = (raw: unknown): raw is string => typeof raw === 'string' && /^(?:Key[A-Z]|Digit[0-9]|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|Arrow(?:Left|Right|Up|Down)|(?:Shift|Control|Alt)(?:Left|Right)|Space|Enter|Backspace|CapsLock|Delete|Insert|Home|End|PageUp|PageDown|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote|Escape)$/.test(raw);
/** 07 §8.6 / 06 §15: every field is checked on its own; anything missing or out of range keeps its default. */
function touchSettings(raw: unknown, d: SettingsData['touch']): SettingsData['touch'] {
  const s = object(raw), out = structuredClone(d), num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  if (has(['auto', 'on', 'off'], s.mode)) out.mode = s.mode;
  if (num(s.opacity, TOUCH.opacityMin, TOUCH.opacityMax)) out.opacity = Math.round(s.opacity);
  if (num(s.size, TOUCH.sizeMin, TOUCH.sizeMax)) out.size = Math.round(s.size);
  if (typeof s.leftHanded === 'boolean') out.leftHanded = s.leftHanded;
  if (typeof s.vibration === 'boolean') out.vibration = s.vibration;
  if (s.effects === null || has(['high', 'low'], s.effects)) out.effects = s.effects as SettingsData['touch']['effects'];
  const layout = object(s.layout);
  for (const id of TOUCH.buttonIds) {
    const e = object(layout[id]);
    if (num(e.x, 0, 1) && num(e.y, 0, 1) && num(e.scale, TOUCH.scaleMin, TOUCH.scaleMax)) out.layout[id] = { x: e.x, y: e.y, scale: e.scale };
  }
  return out;
}
function settings(raw: unknown, defaults: SettingsData): SettingsData {
  const source = object(raw), volume = object(source.volume), result = defaults;
  for (const key of Object.keys(result.volume) as (keyof SettingsData['volume'])[]) {
    const value = volume[key]; if (integer(value) && value <= S.volumeMax && value % S.volumeStep === 0) result.volume[key] = value;
  }
  for (const key of ['showTimer', 'screenShake', 'damageNumbers'] as const) if (typeof source[key] === 'boolean') result[key] = source[key];
  if (has(['auto', 'keyboard', 'xbox', 'playstation'], source.promptStyle)) result.promptStyle = source.promptStyle;
  result.touch = touchSettings(source.touch, defaults.touch);
  const bindings = object(source.bindings), keyboard = object(bindings.keyboard), gamepad = object(bindings.gamepad);
  const keys = structuredClone(defaults.bindings.keyboard), pads = { ...defaults.bindings.gamepad }, actions = Object.keys(keys) as ActionId[];
  let keysValid = true, padsValid = true; const usedKeys = new Set<string>(), usedPads = new Set<number>();
  for (const action of actions) {
    const values = keyboard[action] === undefined ? keys[action] : keyboard[action];
    if (!Array.isArray(values) || values.length !== keys[action].length || values.every((value) => value === null)) keysValid = false;
    else {
      for (const [index, value] of values.entries()) {
        if (value === null) continue;
        if (!keyCode(value) || fixedKey(value) && !(action === 'pause' && index === 0 && value === 'Escape') || usedKeys.has(value)) keysValid = false;
        else usedKeys.add(value);
      }
      if (action === 'pause' && values[0] !== 'Escape') keysValid = false;
      keys[action] = [...values] as [string | null, string | null];
    }
    const value = gamepad[action] === undefined ? pads[action] : gamepad[action];
    if (['left', 'right', 'up', 'down'].includes(action)) { if (value !== null) padsValid = false; }
    else if (!integer(value) || value > S.padMax || value >= S.padDpadStart || value === defaults.bindings.gamepad.pause && action !== 'pause'
      || action === 'pause' && value !== defaults.bindings.gamepad.pause || usedPads.has(value)) padsValid = false;
    else { pads[action] = value; usedPads.add(value); }
  }
  if (keysValid && padsValid) { result.bindings.keyboard = keys; result.bindings.gamepad = pads; }
  return result;
}

export function validateSave(raw: unknown): SaveData {
  const source = object(migrateSave(raw)), result = defaultSave();
  result.settings = settings(source.settings, result.settings);
  result.lastRoad = road(source.lastRoad) ? source.lastRoad : result.lastRoad;
  result.typedSeed = seed(source.typedSeed) ? source.typedSeed : null;
  result.training = unique(source.training, (value): value is number => integer(value) && value >= 1 && value <= S.trainingStations);
  const progress = object(source.progress), unlocks = object(source.unlocks), startWeapons = object(unlocks.startWeapons), totals = object(source.stats);
  result.progress.levelsReached = [...new Set(['plains', ...unique(progress.levelsReached, (value): value is string => has(SAVE_STAGE_IDS, value))])];
  if (typeof progress.stage1Cleared === 'boolean') result.progress.stage1Cleared = progress.stage1Cleared;
  const discoveries = [...Object.values(BONDS).map((bond) => bond.id), ...Object.values(HYBRIDS).map((hybrid) => hybrid.id)];
  result.progress.classesDiscovered = unique(progress.classesDiscovered, (value): value is BondId | HybridId => has(discoveries, value));
  result.unlocks.blueprints = unique(unlocks.blueprints, (value): value is WeaponId | AbilityId => has(BLUEPRINT_IDS, value));
  for (const classId of CLASS_IDS) {
    const values = unique(startWeapons[classId], (value): value is WeaponId => value === THIRD_START_WEAPON[classId]);
    if (Array.isArray(startWeapons[classId])) result.unlocks.startWeapons[classId] = values;
  }
  const chosen = object(source.lastKit);
  if (cls(chosen.cls) && startWeapon(chosen.cls, chosen.weapon, result.unlocks.startWeapons)) result.lastKit = { cls: chosen.cls, weapon: chosen.weapon };
  for (const key of Object.keys(result.stats) as (keyof SaveData['stats'])[]) if (integer(totals[key])) result.stats[key] = totals[key];
  for (const [key, value] of Object.entries(object(source.pbs))) { const entry = pbKey(key) ? personalBest(value) : null; if (entry) result.pbs[key as PbKey] = entry; }
  for (const [key, value] of Object.entries(object(source.bestSegments))) {
    if (pbKey(key) && Array.isArray(value) && value.length === RUN.STAGE_COUNT && value.every((tick) => tick === null || integer(tick))) result.bestSegments[key] = [...value] as NonNullable<SaveData['bestSegments'][PbKey]>;
  }
  for (const [key, value] of Object.entries(object(source.practiceBests))) if (practiceKey(key) && integer(value)) result.practiceBests[migratePracticeKey(key)] = value;
  result.history = (Array.isArray(source.history) ? source.history.map(runRecord).filter((entry): entry is RunRecord => entry !== null) : [])
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, S.historyLimit);
  return result;
}
