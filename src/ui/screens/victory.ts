// The run summary after the Enemy King (07 §7.11): VICTORY, the final time, splits, the Dragon, and what was unlocked.
// Drawn with the run-end panel (a compact version of 07's full table: see docs/SPEC-GAPS.md).
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { formatTime } from '../../core/time.ts';
import { layoutCode } from '../../core/run/layout.ts';
import { WEAPON_NAME } from '../../data/uiText.ts';
import type { RunSoFarData } from './runSoFar.ts';

export const VICTORY_UI = { title: 'VICTORY', lineGap: 11, dragon: { absent: 'Not this run', skipped: 'Skipped', escaped: 'Escaped', killed: 'Slain' } as const,
  deathAnimSeconds: 1.5, inputLockSeconds: 1.0 } as const;

const unlockName = (id: string): string => (id in ABILITY_INFO ? ABILITY_INFO[id as keyof typeof ABILITY_INFO].name : WEAPON_NAME(id as never));

/** The lines of the victory panel for a completed run. */
export function victoryLines(w: GameWorld): string[] {
  const r = w.run, key = r.startKit && r.road ? `${r.startKit.cls}|${r.road}` as const : null, pb = key ? w.records.pbs[key] : undefined;
  const lines = [`Time ${formatTime(r.runTicks)}`];
  if (r.seeded || w.opts.practice) lines.push('Seeded run - records not saved');
  else if (pb && pb.ticks === r.runTicks) lines.push('* NEW PERSONAL BEST *');
  else if (pb) lines.push(`Personal best ${formatTime(pb.ticks)}`);
  r.splits.forEach((s, i) => lines.push(`Stage ${i + 1} ${s === null ? '-' : formatTime(s)}`));
  // 06 §8.7: the layout of the stages played (Stage 2 on the road taken).
  const played = ['plains', r.road === 'forest' ? 'swamps' : 'mountains', 'kingdom', 'castle'] as const;
  lines.push(`Layout ${played.map((id) => layoutCode(r.layout[id])).join('  ')}`);
  lines.push(`Class: ${w.classState.displayName}   Road: ${r.road === 'forest' ? 'Forest' : 'Mountain'}`);
  lines.push(`Dragon: ${VICTORY_UI.dragon[r.dragon.present ? r.dragon.outcome === 'absent' ? 'skipped' : r.dragon.outcome : 'absent']}   Kills: ${r.stats.kills}   Gold: ${w.gold}`);
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
