// The Training Yard checklist board (docs/levels/training-yard.md "The end"): every station with a check when done.
import { TRAINING_STATION_NAMES } from '../../data/uiText.ts';

export function checklistLines(done: ReadonlySet<number>): string[] {
  const n = TRAINING_STATION_NAMES.length;
  return [
    `Training  ${[...done].filter((id) => id >= 1 && id <= n).length} / ${n}`,
    ...TRAINING_STATION_NAMES.map((name, i) => `${done.has(i + 1) ? '[x]' : '[ ]'} ${String(i + 1).padStart(2)} ${name}`),
  ];
}
