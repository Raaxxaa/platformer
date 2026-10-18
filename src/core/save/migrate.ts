// Version migrations (06 §15.1). Version 1 is the first save format.
import { SAVE_RULES } from '../../data/save.ts';

export class NewerSaveVersionError extends Error {
  constructor() { super('Save is from a newer version'); this.name = 'NewerSaveVersionError'; }
}

export function migrateSave(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Save must be an object');
  const save = raw as Record<string, unknown>;
  if (save.v === undefined) return { ...save, v: SAVE_RULES.version };
  if (typeof save.v !== 'number' || !Number.isInteger(save.v) || save.v < SAVE_RULES.version) throw new Error('Invalid save version');
  if (save.v > SAVE_RULES.version) throw new NewerSaveVersionError();
  return raw;
}
