// anims.json by atlas and key (08 §16). Pure: no Phaser.
import { WEAPON_ART } from '../../data/animKeys.ts';
import type { AnimDef } from './animClock.ts';
import type { Lookup } from './pickAnim.ts';

export class AnimBank {
  private readonly map = new Map<string, AnimDef>();
  constructor(list: AnimDef[]) {
    for (const a of list) this.map.set(`${a.atlas}/${a.key}`, a);
  }
  get(atlas: string, key: string): AnimDef | undefined {
    return this.map.get(`${atlas}/${key}`);
  }
  /** Player body keys, falling back to the weapon atlases for `dive_<weapon>_*`. */
  player(outfit: string): Lookup {
    const weapons = Object.keys(WEAPON_ART).map((w) => `weapon_${w}`);
    return (k) => this.get(`player_${outfit}`, k) ?? weapons.map((a) => this.get(a, k)).find((d) => d !== undefined);
  }
  /** Relative enemy keys (`idle`, `atk_slash`): regulars in `enemies_<level>` as `<id>_<key>`, bosses in `boss_<id>`. */
  enemy(id: string, boss: boolean, level = 'plains'): Lookup {
    return boss ? (k) => this.get(`boss_${id}`, k) : (k) => this.get(`enemies_${level}`, `${id}_${k}`);
  }
  vfx(key: string): AnimDef | undefined { return this.get('vfx', key); }
  projectile(key: string): AnimDef | undefined { return this.get('projectiles', key); }
}
