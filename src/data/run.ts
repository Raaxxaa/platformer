// Run destinations and random-seed alphabet (06 §2.5, §7.1).
export const NEXT_VILLAGE = { 1: 'crossroads', 2: 'border', 3: 'rebel_camp' } as const;
export const ROAD_LEVEL = { mountain: 'mountains', forest: 'swamps' } as const;
export const DRAGON_ROLL = { chance: .30, stage2Chance: .5, colors: ['red', 'white', 'storm', 'green'] } as const;
export const RANDOM_SEED = { length: 8, alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' } as const;
export const LEVEL_FILE: Record<string, string> = { home: 'village_home', crossroads: 'village_crossroads', border: 'village_border', rebel_camp: 'village_rebel_camp' };
