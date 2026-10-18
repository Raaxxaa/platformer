// World-anchored shop UI (07 §6.4). This reads core state; purchases are handled by the core.
import type Phaser from 'phaser';
import { interactTarget } from '../../core/abilities/items.ts';
import { MERCHANT_LAYOUT, priceOf, upgradePrice } from '../../core/loot/merchant.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { FLASK, TICK_RATE } from '../../core/tuning.ts';
import { KEYS_MAX, PRICES } from '../../data/economy.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { UI_COLOR } from '../../data/uiText.ts';
import { SHOP_UI as U } from '../../data/shopUi.ts';
export interface ServiceTag { price: number | null; word: string | null; hidden?: boolean }
export function serviceTag(w: GameWorld, kind: string, slot = 0): ServiceTag {
  let base = 0, word: string | null = null;
  if (kind === 'ability_altar' || kind === 'merchant_altar') { const s = w.abilities.slots[slot]; if (!s) return { price: null, word: 'No ability', hidden: true }; if (s.level >= MERCHANT_LAYOUT.maxLevel) word = 'MAX'; else return { price: upgradePrice(w, s.level + 1), word: null }; }
  else if (kind === 'shop_flask') { base = PRICES.flaskUpgrade; if (w.flask.maxCharges >= FLASK.MAX_CHARGES) word = 'MAX'; }
  else if (kind === 'shop_refill') { base = PRICES.flaskRefill; if (w.flask.charges === w.flask.maxCharges) word = 'Full'; }
  else if (kind === 'shop_key') { base = PRICES.key; if (!w.shop?.keyInStock) return { price: null, word: null, hidden: true }; if (w.econ.keys >= KEYS_MAX) word = 'Keys full'; }
  else if (kind === 'shop_reroll') base = PRICES.rerollBase + PRICES.rerollStep * (w.shop?.rerollCount ?? 0);
  return { price: word ? null : priceOf(base, false, !!w.econ.statStacks.haggler), word };
}
export class ShopView {
  private scene: Phaser.Scene;
  private tags = new Map<string, { coin: Phaser.GameObjects.Image; text: Phaser.GameObjects.BitmapText }>();
  private blinkUntil = -1;
  private blinkId: number | null = null;
  constructor(scene: Phaser.Scene) { this.scene = scene; }
  update(w: GameWorld, refused = false): void {
    if (!w.shop) return;
    const target = interactTarget(w);
    if (refused) { this.blinkUntil = w.tick + U.blinkTicks; this.blinkId = target?.id ?? null; }
    const live = new Set<string>();
    const tag = (key: string, x: number, y: number, value: ServiceTag, id: number) => {
      if (value.hidden) return; live.add(key);
      let t = this.tags.get(key);
      if (!t) { t = { coin: this.scene.add.image(0, 0, 'ui', 'hud_coin').setOrigin(0).setDepth(DEPTH.items + 2), text: this.scene.add.bitmapText(0, 0, FONTS.small, '').setDepth(DEPTH.items + 2) }; this.tags.set(key, t); }
      const blink = id === this.blinkId && w.tick < this.blinkUntil && Math.floor(w.tick / (TICK_RATE / (U.blinkHz * 2))) % 2 === 0;
      const color = blink ? UI_COLOR.bad : value.word ? UI_COLOR.textDim : w.gold >= (value.price ?? 0) ? UI_COLOR.highlight : UI_COLOR.bad;
      t.text.setText(value.word ?? String(value.price)).setTint(color);
      const coinW = value.word ? 0 : t.coin.width + U.textGap, left = Math.round(x - (coinW + t.text.width) / 2);
      t.coin.setVisible(!value.word).setPosition(left, y + U.tagBelow); t.text.setPosition(left + coinW, y + U.tagBelow);
    };
    for (const o of w.level?.objects ?? []) {
      if (o.type === 'shop_item') { const slot = Number(o.props.slot); if (w.shop.slots[slot] === 'sold') tag(`sold${slot}`, o.x, o.y, { price: null, word: 'SOLD' }, -o.id); }
      else if (o.type === 'ability_altar' || o.type.startsWith('shop_')) {
        const ia = w.interactables.find((i) => i.x === o.x && i.kind === o.type);
        tag(`service${o.id}`, o.x, o.y, serviceTag(w, o.type, o.type === 'ability_altar' ? Number(o.props.slot) - 1 : 0), ia?.id ?? -o.id);
      }
    }
    for (const [key, t] of this.tags) if (!live.has(key)) { t.coin.destroy(); t.text.destroy(); this.tags.delete(key); }
  }
}
