// Daily twists (06 §14.1, M18): one per daily, the third draw of the `daily` stream.
export const TWISTS = ['golden_hour', 'glass_cannon', 'elite_patrol', 'heavy_pockets', 'swift', 'blood_moon', 'rush_hour', 'arsenal', 'dragon_day', 'classic'] as const;
export type TwistId = (typeof TWISTS)[number];
export const TWIST_NAME: Record<TwistId, string> = {
  golden_hour: 'Golden Hour', glass_cannon: 'Glass Cannon', elite_patrol: 'Elite Patrol', heavy_pockets: 'Heavy Pockets', swift: 'Swift',
  blood_moon: 'Blood Moon', rush_hour: 'Rush Hour', arsenal: 'Arsenal', dragon_day: 'Dragon Day', classic: 'Classic',
};
export const TWIST_TEXT: Record<TwistId, string> = {
  golden_hour: 'Lucky Blocks always give a buff', glass_cannon: 'You deal +50% damage and take +50%',
  elite_patrol: 'An extra elite in section 2 of every stage', heavy_pockets: 'Double gold; prices ×1.5',
  swift: '+20% move speed for you and every enemy', blood_moon: 'Enemies +25% HP; flask fill per kill ×2',
  rush_hour: "Rush can't drop below level 1", arsenal: 'Start with a random B-grade second weapon',
  dragon_day: 'The Dragon is always present', classic: 'No twist',
};
export const TWIST_FX = {
  glassCannonOut: 1.5, glassCannonIn: 1.5, goldMult: 2, priceMult: 1.5, swiftPercent: 20, swiftEnemyMult: 1.2,
  bloodMoonHp: 1.25, bloodMoonFill: 2, arsenalGrade: 'B', elitePatrolOffset: 32,
} as const;

/** Title → Daily menu (06 §14.1, M18). */
export const DAILY_MENU_UI = {
  panel: [56, 40, 528, 240] as const, titleY: 52, rowsY: 92, rowStep: 20, rowW: 480, hintY: 260, twistY: 70,
  rows: ['today', 'weekly', 'past', 'seed', 'seedWeekly', 'leaderboard', 'back'] as const,
  seedPrompt: 'Type a seed (A–Z, 0–9, up to 12)',
} as const;
