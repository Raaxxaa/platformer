import { describe, expect, it } from 'vitest';
import { ATLASES, BOSS_ANIMS, DIVE_PARTS, DUMMY_FRAMES, ENEMY_ANIMS, FONTS, OBJECT_FRAMES, PLAYER_ANIMS, PROJECTILE_ANIMS, VFX_ANIMS, WEAPON_ART, weaponDiveKey, weaponStepKey } from './animKeys.ts';

interface Def { key: string; atlas: string; frames: string[] }
import animsJson from '../../public/assets/anims.json';
const anims = animsJson as Def[];
const atlasJson = import.meta.glob('../../public/assets/atlases/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const files = new Set(Object.keys(import.meta.glob(['../../public/assets/atlases/*.png', '../../public/assets/fonts/*'])).map((k) => k.replace('../../', '')));
const existsSync = (f: string) => files.has(f);
const find = (atlas: string, key: string) => anims.find((a) => a.atlas === atlas && a.key === key);
function frames(atlas: string): Set<string> {
  const j = atlasJson[`../../public/assets/atlases/${atlas}.json`];
  const f = j.frames ?? j.textures[0].frames;
  return new Set(Array.isArray(f) ? f.map((x: { filename: string }) => x.filename) : Object.keys(f));
}

describe('anim keys used by the view exist in the art', () => {
  it('every atlas file exists', () => {
    for (const a of ATLASES) expect(existsSync(`public/assets/atlases/${a}.png`), a).toBe(true);
  });
  it('player anims, with trim frames for every body frame', () => {
    const trim = frames('player_swordsman_trim');
    for (const k of PLAYER_ANIMS) {
      const d = find('player_swordsman', k);
      expect(d, k).toBeDefined();
      for (const f of d!.frames) { expect(trim.has(`a/${f}`), f).toBe(true); expect(trim.has(`b/${f}`), f).toBe(true); }
    }
  });
  it('weapon steps: body anim + weapon frames + smear; dives', () => {
    for (const [id, { steps }] of Object.entries(WEAPON_ART)) {
      const wf = frames(`weapon_${id}`);
      for (let s = 0; s < steps; s++) {
        const d = find('player_swordsman', weaponStepKey(id, s));
        expect(d, weaponStepKey(id, s)).toBeDefined();
        for (const f of d!.frames) expect(wf.has(f), f).toBe(true);
        expect(wf.has(`${weaponStepKey(id, s)}_smear`)).toBe(true);
      }
      for (const p of DIVE_PARTS) expect(find(`weapon_${id}`, weaponDiveKey(id, p)), weaponDiveKey(id, p)).toBeDefined();
    }
  });
  it('enemy, boss, projectile and vfx anims', () => {
    for (const [id, list] of Object.entries(ENEMY_ANIMS)) for (const k of list) expect(find('enemies_plains', `${id}_${k}`), `${id}_${k}`).toBeDefined();
    for (const [id, list] of Object.entries(BOSS_ANIMS)) for (const k of list) expect(find(`boss_${id}`, k), `${id} ${k}`).toBeDefined();
    for (const k of PROJECTILE_ANIMS) expect(find('projectiles', k), k).toBeDefined();
    for (const k of VFX_ANIMS) expect(find('vfx', k), k).toBeDefined();
  });
  it('object and dummy frames', () => {
    const o = frames('objects');
    const D = OBJECT_FRAMES;
    for (const f of [D.arenaDoor.cap, D.arenaDoor.mid, D.arenaDoor.bottom, ...Object.values(D.timedDoor.cap), D.timedDoor.mid, D.timedDoor.bottom, ...D.guideArrow]) expect(o.has(f), f).toBe(true);
    const x = frames('enemies_extra');
    for (const f of [...DUMMY_FRAMES.idle, ...DUMMY_FRAMES.hit]) expect(x.has(f), f).toBe(true);
  });
  it('fonts exist', () => {
    for (const f of Object.values(FONTS)) { expect(existsSync(`public/assets/fonts/${f}.xml`)).toBe(true); expect(existsSync(`public/assets/fonts/${f}.png`)).toBe(true); }
  });
});
