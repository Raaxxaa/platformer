// Grey-box ability visuals in class colors (M4 Task 15): ability hit boxes (Whirlwind, Shockwave, Thunder Strike
// columns, Arrow Rain waves) linger briefly, the Arrow Rain zone with falling lines, dash trails, Blink flashes at both
// ends, Lightning chain lines, a mark over marked enemies, and the Training Dummy DPS readout (07 §5.8).
import Phaser from 'phaser';
import type { AbilityId } from '../../core/abilities/types.ts';
import { enemyCenter, enemyRect } from '../../core/enemies/enemy.ts';
import type { GameWorld, WorldEvent } from '../../core/sim/gameWorld.ts';
import { ticks } from '../../core/tuning.ts';
import { ABILITY_INFO } from '../../data/abilities.ts';
import { FONTS, itemIcon } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { ABILITY_FX as F, SLOT_LAYOUT } from '../../data/stageUi.ts';
import { CLASS_COLOR, UI_COLOR } from '../../data/uiText.ts';
import { DPS, dummyDps } from '../../ui/hud/dummyDps.ts';

interface Rect { x: number; y: number; w: number; h: number }
const colorOf = (id: string | undefined) => {
  const cls = id ? ABILITY_INFO[id as AbilityId]?.cls : null;
  return cls ? CLASS_COLOR[cls] : CLASS_COLOR.neutral;
};

export class AbilityView {
  private g: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private boxes: { r: Rect; color: number; until: number }[] = [];
  private trail: { r: Rect; color: number; until: number }[] = [];
  private blinks: { x: number; y: number; until: number }[] = [];
  private chains: { a: number; b: number; until: number }[] = [];
  private markIcons = new Map<number, Phaser.GameObjects.Image>();
  private dps = new Map<number, { hits: { tick: number; amount: number }[]; text: Phaser.GameObjects.BitmapText }>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(DEPTH.vfx - 1);
  }

  reset(): void {
    this.boxes = []; this.trail = []; this.blinks = []; this.chains = [];
    for (const d of this.dps.values()) d.text.destroy();
    this.dps.clear();
  }

  /** After each world tick: what this tick did. `before` is the player's feet before the tick. */
  onTick(w: GameWorld, events: readonly WorldEvent[], before: { x: number; y: number }): void {
    const now = w.tick, b = w.body;
    for (const g of w.hitGroups) {
      if (g.owner === 'player' && g.ability && g.active) this.boxes.push({ r: { ...g.rect }, color: colorOf(g.ability), until: now + ticks(F.boxS) });
    }
    const owner = b.forced?.owner ?? '';
    if (b.state === 'forced' && owner.startsWith('ability:') && now % F.trailEvery === 0) {
      this.trail.push({ r: { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }, color: colorOf(owner.slice(8)), until: now + ticks(F.trailS) });
    }
    for (const e of events) {
      if (e.t === 'abilityUsed' && e.id === 'blink') {
        this.blinks.push({ x: before.x, y: before.y - b.h / 2, until: now + ticks(F.blinkS) }, { x: b.x, y: b.y - b.h / 2, until: now + ticks(F.blinkS) });
      }
      if (e.t === 'hit' && e.chainFrom !== undefined && typeof e.target === 'number') this.chains.push({ a: e.chainFrom, b: e.target, until: now + ticks(F.chainS) });
      if (e.t === 'hit' && typeof e.target === 'number') {
        const en = w.enemies.find((x) => x.id === e.target);
        if (en?.def.id === 'training_dummy') {
          let d = this.dps.get(en.id);
          if (!d) { d = { hits: [], text: this.scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.hud - 1) }; this.dps.set(en.id, d); }
          d.hits.push({ tick: now, amount: e.amount });
        }
      }
    }
  }

  update(w: GameWorld): void {
    const now = w.tick, g = this.g.clear();
    const keep = <T extends { until: number }>(l: T[]) => l.filter((x) => x.until > now);
    this.boxes = keep(this.boxes); this.trail = keep(this.trail); this.blinks = keep(this.blinks); this.chains = keep(this.chains);
    // Arrow Rain zones, with falling lines.
    for (const ent of w.abilityEntities) {
      if (ent.kind !== 'arrow_rain' || !ent.view) continue;
      const { zone } = ent.view() as { zone: Rect };
      const c = colorOf('arrow_rain');
      g.fillStyle(c, F.zoneAlpha).fillRect(zone.x, zone.y, zone.w, zone.h);
      g.lineStyle(1, c, 0.8);
      for (let i = 0; i < F.rainLines; i++) {
        const x = zone.x + ((i + 0.5) * zone.w) / F.rainLines;
        const y = zone.y + ((now * F.rainSpeed + i * 17) % Math.max(1, zone.h - F.rainLen));
        g.lineBetween(x, y, x - 2, y + F.rainLen);
      }
    }
    for (const t of this.trail) g.fillStyle(t.color, F.trailAlpha * ((t.until - now) / ticks(F.trailS))).fillRect(t.r.x, t.r.y, t.r.w, t.r.h);
    for (const bx of this.boxes) {
      const a = F.boxAlpha * ((bx.until - now) / ticks(F.boxS));
      g.fillStyle(bx.color, a).fillRect(bx.r.x, bx.r.y, bx.r.w, bx.r.h);
      g.lineStyle(1, bx.color, Math.min(1, a * 2)).strokeRect(bx.r.x + 0.5, bx.r.y + 0.5, bx.r.w - 1, bx.r.h - 1);
    }
    for (const bl of this.blinks) {
      const f = (bl.until - now) / ticks(F.blinkS);
      g.fillStyle(CLASS_COLOR.wizard, 0.6 * f).fillCircle(bl.x, bl.y, F.blinkR * (1.5 - f / 2));
      g.fillStyle(0xffffff, 0.8 * f).fillCircle(bl.x, bl.y, F.blinkR / 3);
    }
    for (const ch of this.chains) {
      const a = w.enemies.find((e) => e.id === ch.a), b = w.enemies.find((e) => e.id === ch.b);
      if (!a || !b) continue;
      const p = enemyCenter(a), q = enemyCenter(b), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 + ((now >> 1) % 2 ? -4 : 4);
      g.lineStyle(1, 0xffe94a, 1).lineBetween(p.x, p.y, mx, my).lineBetween(mx, my, q.x, q.y);
    }
    // Marks over marked enemies.
    const marked = new Set<number>();
    for (const ent of w.abilityEntities) {
      if (ent.kind !== 'mark' || !ent.view) continue;
      const { enemyId } = ent.view() as { enemyId: number };
      const e = w.enemies.find((x) => x.id === enemyId && !x.dead);
      if (!e) continue;
      marked.add(enemyId);
      let ic = this.markIcons.get(enemyId);
      if (!ic) { ic = this.scene.add.image(0, 0, 'ui', itemIcon('ability', 'hunters_mark')).setOrigin(0.5, 1).setDepth(DEPTH.vfx); this.markIcons.set(enemyId, ic); }
      ic.setPosition(e.x, enemyRect(e).y - F.markLift);
    }
    for (const [id, ic] of this.markIcons) if (!marked.has(id)) { ic.destroy(); this.markIcons.delete(id); }
    // DPS readout 14 px above each Training Dummy.
    for (const [id, d] of this.dps) {
      const e = w.enemies.find((x) => x.id === id);
      const v = e ? dummyDps(d.hits, now) : null;
      d.hits = d.hits.filter((h) => now - h.tick <= ticks(DPS.windowS));
      d.text.setVisible(v !== null).setText(v === null ? '' : `DPS ${v}`).setTint(UI_COLOR.text);
      if (e) d.text.setPosition(e.x, enemyRect(e).y - SLOT_LAYOUT.dpsLift);
    }
  }
}
