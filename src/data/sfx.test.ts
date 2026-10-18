import { describe, expect, it } from 'vitest';
import { SFX, sfxFiles } from './sfx.ts';

const files = new Set(Object.keys(import.meta.glob('../../public/assets/audio/sfx/*.wav')).map((k) => k.replace('../../', '')));
const existsSync = (f: string) => files.has(f);

describe('SFX table', () => {
  it('every required sound file exists; optional ART7 sounds may be silent until the art branch lands', () => {
    for (const id of Object.keys(SFX)) if (!SFX[id].optional) for (const f of sfxFiles(id)) expect(existsSync(`public/assets/audio/sfx/${f}`), f).toBe(true);
  });
});
