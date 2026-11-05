// The run summary after the Enemy King (07 §7.11): VICTORY, the final time, splits, the Dragon, and what was unlocked.
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { formatDelta, formatTime } from '../../core/time.ts';
import { isAssisted } from '../../core/run/runState.ts';
import { CLASS_NAME } from '../../data/classes.ts';
import { layoutCode } from '../../core/run/layout.ts';
import { WEAPON_NAME } from '../../data/uiText.ts';
import type { RunSoFarData } from './runSoFar.ts';

export const VICTORY_UI = { title: 'VICTORY', lineGap: 10, dragon: { absent: 'Not this run', skipped: 'Skipped', escaped: 'Escaped', killed: 'Slain' } as const,
  deathAnimSeconds: 1.5, inputLockSeconds: 1.0 } as const;

const unlockName = (id: string): string => (id in ABILITY_INFO ? ABILITY_INFO[id as keyof typeof ABILITY_INFO].name : WEAPON_NAME(id as never));

const BIOME: Record<string, string> = { plains: 'Plains', mountains: 'Mountains', swamps: 'Swamps', kingdom: 'Kingdom', castle: 'Castle' };

/** The lines of the run summary (07 §7.11): time, PB line, the splits table (segment, run time, delta vs the PB, ★ best
 * segment), the class, road, seed, the run's counters, the Dragon, the layouts, and what was unlocked. */
export function victoryLines(w: GameWorld): string[] {
  const r = w.run, key = r.startKit && r.road ? `${r.startKit.cls}|${r.road}` as const : null, pb = key ? w.records.pbs[key] : undefined;
  const best = key ? w.records.bestSegments[key] : undefined;
  const lines = [`Time ${formatTime(r.runTicks)}`];
  if (r.seeded || w.opts.practice) lines.push('Seeded run - records not saved');
  else if (isAssisted(r)) lines.push('Assisted run - records not saved');
  else if (pb && pb.ticks === r.runTicks) lines.push('* NEW PERSONAL BEST *');
  else if (pb) lines.push(`Personal best ${formatTime(pb.ticks)}`);
  const played = ['plains', r.road === 'forest' ? 'swamps' : 'mountains', 'kingdom', 'castle'] as const;
  r.splits.forEach((s, i) => {
    if (s === null) { lines.push(`Stage ${i + 1} ${BIOME[played[i]]}  -`); return; }
    const seg = s - (i === 0 ? 0 : r.splits[i - 1] ?? 0), cmp = pb && pb.ticks !== r.runTicks ? pb.splits[i] : null;
    const star = best?.[i] === seg ? ' *' : '';
    lines.push(`Stage ${i + 1} ${BIOME[played[i]]}  ${formatTime(seg)}  ${formatTime(s)}${cmp !== null && cmp !== undefined ? `  ${formatDelta(s - cmp)}` : ''}${star}`);
  });
  const start = r.startKit ? CLASS_NAME[r.startKit.cls] : '?';
  lines.push(`Class: ${start} -> ${w.classState.displayName}   Road: ${r.road === 'forest' ? 'Forest' : 'Mountain'}   Seed: ${r.seedText}`);
  lines.push(`Kills: ${r.stats.kills} (elites ${r.stats.eliteKills})   Gold earned: ${Math.floor(r.goldEarnedTenths / 10)}`);
  lines.push(`Chests: ${r.stats.chestsOpened}   Lucky Blocks: ${r.stats.luckyBlocksBroken}   Flasks drunk: ${r.stats.flasksDrunk}   Damage taken: ${r.stats.damageTaken}`);
  lines.push(`Dragon: ${VICTORY_UI.dragon[r.dragon.present ? r.dragon.outcome === 'absent' ? 'skipped' : r.dragon.outcome : 'absent']}   Layout ${played.map((id) => layoutCode(r.layout[id])).join(' ')}`);
  if (r.winUnlocks.blueprint) lines.push(`Unlocked: ${unlockName(r.winUnlocks.blueprint)}`);
  if (r.winUnlocks.startWeapon) lines.push(`New starting weapon: ${unlockName(r.winUnlocks.startWeapon)}`);
  return lines;
}

export function victoryData(w: GameWorld): RunSoFarData {
  return {
    runTicks: w.run.runTicks, split1: w.run.splits[0], gold: w.gold, kills: w.run.stats.kills,
    kit: { weapons: structuredClone(w.combat.slots), abilities: w.abilities.slots.map((s) => s ? { id: s.id, level: s.level } : null), displayName: w.classState.displayName },
    title: VICTORY_UI.title, lines: victoryLines(w), lineGap: VICTORY_UI.lineGap,
  };
}
