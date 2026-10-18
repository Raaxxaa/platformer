import { describe, it, expect } from 'vitest';
import { Bodies } from '../physics/bodies.ts';
import { gridFromRects } from '../level/build.ts';
import { createPlayerBody } from '../player/body.ts';
import { buildCollapsingPlatforms, stepCollapsingPlatforms } from './collapsingPlatforms.ts';
import { createMinecart } from '../player/minecart.ts';
function fixture(scale = 1) {
  const g = gridFromRects(50, 40, []);
  const bodies = new Bodies(g.w, g.h);
  g.bodies = bodies;
  bodies.add({ id: 'bridge', x: 160, y: 320, w: 64, h: 16, active: true, oneWay: false, surface: 'normal', grabbable: true, noTeleport: false });
  const b = createPlayerBody(180, 320);
  const platforms = buildCollapsingPlatforms([{ id: 1, type: 'collapsing_platform', x: 160, y: 320, w: 64, h: 16, props: { id: 'bridge' } }]);
  const step = (carts: ReturnType<typeof createMinecart>[] = [], dive = false) => stepCollapsingPlatforms(platforms, bodies, g, b, carts, scale, dive);
  return { g, bodies, b, platforms, step };
}
describe('collapsing platforms (01 §13.5)', () => {
  it('triggers once, collapses60ticks later even after leaving, gives coyote, respawns480ticks later', () => {
    const { bodies, b, step } = fixture();
    expect(step()).toContain('platformShake');
    for (let n = 0; n < 59; n++)
      step();
    expect(bodies.get('bridge')!.active).toBe(true);
    expect(step()).toContain('platformCollapse');
    expect(b.grounded).toBe(false);
    expect(b.coyoteValid).toBe(true);
    b.x = 300;
    for (let n = 0; n < 479; n++)
      step();
    expect(bodies.get('bridge')!.active).toBe(false);
    step();
    expect(bodies.get('bridge')!.active).toBe(true);
  });
  it('overlap delays respawn; dead player never starts it; dive collapses immediately', () => {
    const { bodies, b, step } = fixture();
    b.state = 'dead';
    step();
    expect(bodies.get('bridge')!.active).toBe(true);
    b.state = 'diveLand';
    expect(step([], true)).toContain('platformCollapse');
    b.y = 330;
    for (let n = 0; n < 500; n++)
      step();
    expect(bodies.get('bridge')!.active).toBe(false);
    b.x = 300;
    step();
    expect(bodies.get('bridge')!.active).toBe(true);
  });
  it('cart support triggers; slow clock takes172ticks and respawnTime0 means never', () => {
    const { bodies, b, platforms, step } = fixture(.35);
    b.x = 300;
    const c = createMinecart(1, 180, 320, 1);
    c.grounded = true;
    expect(step([c])).toContain('platformShake');
    for (let n = 0; n < 171; n++)
      step();
    expect(bodies.get('bridge')!.active).toBe(true);
    step();
    expect(bodies.get('bridge')!.active).toBe(false);
    platforms[0].respawnTicks = 0;
    for (let n = 0; n < 2000; n++)
      step();
    expect(bodies.get('bridge')!.active).toBe(false);
  });
});
