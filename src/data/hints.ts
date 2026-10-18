import type { HintAction } from '../core/run/zones.ts';
import type { PromptPart } from '../ui/promptLine.ts';
// First-run hint words (07 §4.13); glyphs always come from current bindings.
export const HINT_PARTS: Record<HintAction, readonly PromptPart[]> = {
  move: [{ action: 'left' }, ' / ', { action: 'right' }, ' — move'], jump: [{ action: 'jump' }, ' — jump'],
  double_jump: [{ action: 'jump' }, ' in the air — double jump'], dash: [{ action: 'dash' }, ' — dash (through attacks)'],
  wall_jump: [{ action: 'jump' }, ' on a wall — wall jump'], slide: [{ action: 'down' }, ' + ', { action: 'dash' }, ' — slide'],
  dive_slam: [{ action: 'down' }, ' + ', { action: 'attack1' }, ' in the air — dive slam'],
  attack: [{ action: 'attack1' }, ' / ', { action: 'attack2' }, ' — attack'], lucky_block: ['Hit the block!'],
  ability: [{ action: 'ability1' }, ' / ', { action: 'ability2' }, ' — ability'], heal: [{ action: 'heal' }, ' — drink the flask'],
  interact: [{ action: 'interact' }, ' — pick up'], drop_through: [{ action: 'down' }, ' + ', { action: 'jump' }, ' — drop through'],
};
