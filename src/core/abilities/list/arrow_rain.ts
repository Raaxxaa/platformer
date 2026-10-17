// Arrow Rain (03 §10.1): a zone ahead, clipped at walls; a wave every 0.2 s hits every enemy in it.
import { ABILITY } from '../../../data/abilities.ts';
import { registerAbility } from '../abilitySystem.ts';
import { abilityHit, addAbilityGroup, newInstance, oneTick } from '../helpers.ts';

const A = ABILITY.arrowRain;

registerAbility('arrow_rain', {
  effect(w, c) {
    const b = w.body, f = b.facing, x = b.x, feet = b.y;
    // Clip the far edge at the first solid pixel along row feetY − 14, scanning from the body center.
    const want = A.near + (c.row.widthPx as number);
    let reach = want;
    for (let d = 0; d <= want; d++) if (w.grid.isSolidPx(Math.floor(x + f * d), feet + A.scanDy)) { reach = d; break; }
    if (reach <= A.near) return;
    const x0 = f > 0 ? x + A.near : x - reach, x1 = f > 0 ? x + reach : x - A.near;
    const zone = { x: x0, y: feet - A.top, w: x1 - x0, h: A.top + A.bottom };
    const waves = c.row.waves as number;
    const spec = abilityHit(c, 'wave', c.row.damagePerWave as number);
    const born = w.tick;
    w.abilityEntities.push({
      id: w.newId(), kind: 'arrow_rain',
      step: (ww) => {
        const t = ww.tick - born;                            // wave k at 24k world ticks after the effect tick
        if (t > 0 && t % A.waveTicks === 0) oneTick(ww, addAbilityGroup(ww, c, spec, zone, newInstance(ww), { kbFromX: x }));
        return t < waves * A.waveTicks;
      },
      view: () => ({ zone, born, waves }),
    });
  },
});
