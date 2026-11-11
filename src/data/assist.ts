// Assist mode (06 §5.4, M14): options and their effects. Off by default.
export const ASSIST = {
  speeds: [1, 0.85, 0.7] as const,
  damage: [1, 0.75, 0.5] as const,
  /** Timed-door limits × this with Longer timed doors. */
  doorMult: 1.5,
  /** Extra max flask charges with Extra flask charge. */
  extraFlask: 1,
  /** The offer on the death screen after this many deaths before the Great Boar was ever beaten. */
  offerAfterDeaths: 5,
} as const;
export type AssistSpeed = (typeof ASSIST.speeds)[number];
export type AssistDamage = (typeof ASSIST.damage)[number];
export interface AssistSettings { speed: AssistSpeed; damageTaken: AssistDamage; extraFlask: boolean; longerDoors: boolean }
export const defaultAssist = (): AssistSettings => ({ speed: 1, damageTaken: 1, extraFlask: false, longerDoors: false });
