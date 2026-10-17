// Loot in the world (M5 Task 9): chests, Lucky Blocks, coins, the merchant with its altars and price tags (ART4/ART6),
// element hit effects and status visuals on enemies, S-grade signature effects, curse wisps and Lucky Block auras.
import Phaser from 'phaser';
import { interactTarget } from '../../core/abilities/items.ts';
import { enemyCenter, enemyRect } from '../../core/enemies/enemy.ts';
import { interactPrompt } from '../../ui/model/prompt.ts';
import { MERCHANT_LAYOUT, priceOf } from '../../core/loot/merchant.ts';
import type { GameWorld } from '../../core/sim/gameWorld.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import type { AnimDef } from './animClock.ts';
import type { TickEvent } from './vfx.ts';
import { FONTS } from '../../data/animKeys.ts';
import { DEPTH } from '../../data/art.ts';
import { PRICES, GOLD } from '../../data/economy.ts';
import { LUCKY } from '../../data/loot.ts';
import { LOOT_FX as F } from '../../data/stageUi.ts';
import { HUD_COLOR, UI_COLOR } from '../../data/uiText.ts';
import { SIGNATURE } from '../../data/weapons.ts';

type Spr = Phaser.GameObjects.Sprite;
interface Fx { s: Spr; def: AnimDef; born: number }

/** A price tag: coin + number, or a word (SOLD, MAX, No ability) in textDim (07 §6.4). */
class Tag {
  coin: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
  constructor(scene: Phaser.Scene) {
    this.coin = scene.add.image(0, 0, 'ui', 'hud_coin').setOrigin(0, 0).setDepth(DEPTH.items + 2);
    this.text = scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0, 0).setDepth(DEPTH.items + 2);
  }
  set(x: number, y: number, price: number | null, word: string | null, affordable: boolean): void {
    const s = word ?? String(price);
    this.text.setText(s).setTint(word ? UI_COLOR.textDim : affordable ? UI_COLOR.highlight : UI_COLOR.bad);
    const coinW = word ? 0 : this.coin.width + 1;
    const left = Math.round(x - (coinW + this.text.width) / 2);
    this.coin.setVisible(!word).setPosition(left, y);
    this.text.setPosition(left + coinW, y);
  }
  destroy(): void { this.coin.destroy(); this.text.destroy(); }
}

export class LootView {
  private defs = new Map<string, AnimDef>();
  private scene: Phaser.Scene;
  private fx: Fx[] = [];
  private loops = new Map<string, Spr>();
  private seen = new Set<string>();
  private chests = new Map<number, Spr>();
  private lucky = new Map<number, Spr>();
  private coins = new Map<number, Spr>();
  private merchant: Spr | null = null;
  private altars = new Map<number, Spr>();
  private tags = new Map<string, Tag>();
  private frozen = new Map<number, boolean>();
  private sigSeen = new Set<number>();
  private prompt: Phaser.GameObjects.BitmapText | null = null;
  private prompt2: Phaser.GameObjects.BitmapText | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (const d of (scene.cache.json.get('anims') ?? []) as AnimDef[]) this.defs.set(d.key, d);
  }

  private frameOf(def: AnimDef, ageS: number, loop = def.mode === 'loop'): string {
    const n = def.frames.length, i = Math.floor(ageS * (def.fps ?? 8));
    return def.frames[loop ? i % n : Math.min(n - 1, i)];
  }

  /** A one-shot VFX anim at (x, y) born on tick `now`. */
  private once(key: string, x: number, y: number, now: number, origin: [number, number] = [0.5, 0.5], flip = false): void {
    const def = this.defs.get(key);
    if (!def) return;
    const s = this.scene.add.sprite(x, y, def.atlas, def.frames[0]).setOrigin(...origin).setFlipX(flip).setDepth(DEPTH.vfx);
    this.fx.push({ s, def, born: now });
  }

  /** A looping anim kept alive under `id` while it is touched each frame. */
  private loop(id: string, key: string, x: number, y: number, now: number, depth: number = DEPTH.vfx): Spr | null {
    const def = this.defs.get(key);
    if (!def) return null;
    let s = this.loops.get(id);
    if (!s) { s = this.scene.add.sprite(x, y, def.atlas, def.frames[0]).setDepth(depth); this.loops.set(id, s); }
    this.seen.add(id);
    return s.setPosition(x, y).setFrame(this.frameOf(def, now / TICK_RATE, true));
  }

  reset(): void {
    for (const f of this.fx) f.s.destroy();
    this.fx = [];
    for (const s of this.loops.values()) s.destroy();
    this.loops.clear();
    this.frozen.clear();
    this.sigSeen.clear();
  }

  update(w: GameWorld, events: readonly TickEvent[]): void {
    const now = w.tick;
    this.seen.clear();
    this.onEvents(w, events);
    this.drawChests(w);
    this.drawLucky(w, now);
    this.drawCoins(w, now);
    this.drawMerchant(w, now);
    this.drawStatuses(w, now);
    this.drawSignatures(w, now);
    this.drawPrompt(w);
    // Curse wisps circle the player while a curse lasts.
    if (w.econ.curse && !w.health.dead) this.loop('curse', 'curse_wisps', w.body.x, w.body.y - w.body.h / 2, now);
    for (const [id, s] of this.loops) if (!this.seen.has(id)) { s.destroy(); this.loops.delete(id); }
    this.fx = this.fx.filter((f) => {
      const age = (now - f.born) / TICK_RATE;
      const n = f.def.frames.length;
      if (age * (f.def.fps ?? 8) >= n) { f.s.destroy(); return false; }
      f.s.setFrame(this.frameOf(f.def, age, false));
      return true;
    });
  }

  private onEvents(w: GameWorld, events: readonly TickEvent[]): void {
    const b = w.body;
    for (const { tick, e } of events) {
      if (e.t === 'chestOpened') {
        const c = w.chests.find((x) => x.objectId === e.objectId);
        if (c) this.once(e.kind === 'cursed' ? 'chest_open_cursed' : 'chest_open', c.x, c.y - F.chestFxLift, tick);
      }
      if (e.t === 'luckyBroken') {
        const l = w.luckyBlocks.find((x) => x.objectId === e.objectId);
        if (l) this.once('lucky_break', l.x, l.y, tick);
      }
      if (e.t === 'luckyResult') {
        const buff = LUCKY.find((l) => l.id === e.id)?.kind === 'buff';
        this.once(buff ? 'buff_aura' : 'debuff_aura', b.x, b.y, tick, [0.5, 1]);
      }
      if (e.t === 'hit' && typeof e.target === 'number' && !e.dot) {
        const en = w.enemies.find((x) => x.id === e.target);
        if (!en) continue;
        const c = enemyCenter(en);
        if (e.chainFrom !== undefined) this.once('chain_spark', c.x, c.y, tick);
        else if (e.element) {
          this.once(`hit_${e.element}`, c.x, c.y, tick);
          if (e.element === 'wind') this.once('wind_gust', c.x, c.y, tick, [0.5, 0.5], en.x < b.x);
        }
      }
    }
  }

  private drawChests(w: GameWorld): void {
    const live = new Set(w.chests.map((c) => c.objectId));
    for (const [id, s] of this.chests) if (!live.has(id)) { s.destroy(); this.chests.delete(id); }
    for (const c of w.chests) {
      let s = this.chests.get(c.objectId);
      if (!s) { s = this.scene.add.sprite(c.x, c.y, 'items', `chest_${c.kind}_closed_00`).setOrigin(0.5, 1).setDepth(DEPTH.items); this.chests.set(c.objectId, s); }
      s.setPosition(c.x, c.y).setFrame(`chest_${c.kind}_${c.opened ? 'open' : 'closed'}_00`);
    }
  }

  private drawLucky(w: GameWorld, now: number): void {
    const def = this.defs.get('lucky_block_idle');
    const live = new Set(w.luckyBlocks.filter((l) => !l.broken).map((l) => l.objectId));
    for (const [id, s] of this.lucky) if (!live.has(id)) { s.destroy(); this.lucky.delete(id); }
    for (const l of w.luckyBlocks) {
      if (l.broken || !def) continue;
      let s = this.lucky.get(l.objectId);
      if (!s) { s = this.scene.add.sprite(l.x, l.y, 'items', def.frames[0]).setDepth(DEPTH.items); this.lucky.set(l.objectId, s); }
      s.setFrame(this.frameOf(def, now / TICK_RATE, true));
    }
  }

  /** Coins spin; they blink in their last second (05 §9.4). */
  private drawCoins(w: GameWorld, now: number): void {
    const def = this.defs.get('coin_spin');
    const live = new Set(w.coins.map((c) => c.id));
    for (const [id, s] of this.coins) if (!live.has(id)) { s.destroy(); this.coins.delete(id); }
    for (const c of w.coins) {
      if (!def) continue;
      let s = this.coins.get(c.id);
      if (!s) { s = this.scene.add.sprite(c.x, c.y, 'items', def.frames[0]).setDepth(DEPTH.items + 1); this.coins.set(c.id, s); }
      const left = GOLD.coinLifeS - (now - c.born) / TICK_RATE;
      const blinkOff = left < GOLD.coinBlinkS && Math.floor(now / (TICK_RATE / (2 * F.coinBlinkHz))) % 2 === 1;
      s.setPosition(c.x, c.y).setFrame(this.frameOf(def, now / TICK_RATE, true)).setVisible(!blinkOff);
    }
  }

  private tag(key: string): Tag {
    let t = this.tags.get(key);
    if (!t) { t = new Tag(this.scene); this.tags.set(key, t); }
    return t;
  }

  /** The merchant NPC, its altars, and price tags under every priced item and altar (07 §6.4). */
  private drawMerchant(w: GameWorld, now: number): void {
    const m = w.merchant;
    const used = new Set<string>();
    if (m?.present) {
      const def = this.defs.get('merchant_idle');
      if (def) {
        if (!this.merchant) this.merchant = this.scene.add.sprite(m.x, m.y, 'npcs', def.frames[0]).setOrigin(0.5, 1).setDepth(DEPTH.items);
        this.merchant.setVisible(true).setPosition(m.x, m.y).setFrame(this.frameOf(def, now / TICK_RATE, true));
      }
      MERCHANT_LAYOUT.items.forEach((dx, i) => {
        if (!m.sold[i]) return;
        used.add(`sold${i}`);
        this.tag(`sold${i}`).set(m.x + dx, m.y + F.tagGap, null, 'SOLD', true);
      });
    } else this.merchant?.setVisible(false);
    for (const it of w.groundItems) {
      if (it.price === undefined) continue;
      const k = `item${it.id}`;
      used.add(k);
      const owned = !!it.ability && w.abilities.slots.some((s) => s?.id === it.ability!.id);
      this.tag(k).set(it.x, it.y + F.tagGap, it.price, owned ? 'Owned' : null, w.gold >= it.price);
    }
    const altarDef = this.defs.get('ability_altar_idle');
    const liveAltars = new Set<number>();
    for (const ia of w.interactables) {
      if (ia.kind !== 'merchant_altar') continue;
      liveAltars.add(ia.id);
      let s = this.altars.get(ia.id);
      if (!s && altarDef) { s = this.scene.add.sprite(ia.x, ia.y, 'objects', altarDef.frames[0]).setOrigin(0.5, 1).setDepth(DEPTH.items - 1); this.altars.set(ia.id, s); }
      if (s && altarDef) s.setFrame(this.frameOf(altarDef, now / TICK_RATE, true));
      const slot = Number(ia.label) as 0 | 1;
      const ab = w.abilities.slots[slot];
      const k = `altar${ia.id}`;
      used.add(k);
      if (!ab) used.delete(k);
      else if (ab.level >= MERCHANT_LAYOUT.maxLevel) this.tag(k).set(ia.x, ia.y + F.tagGap, null, 'MAX', false);
      else { const p = priceOf(PRICES.upgradeTo[ab.level + 1], false); this.tag(k).set(ia.x, ia.y + F.tagGap, p, null, w.gold >= p); }
    }
    for (const [id, s] of this.altars) if (!liveAltars.has(id)) { s.destroy(); this.altars.delete(id); }
    for (const [k, t] of this.tags) if (!used.has(k)) { t.destroy(); this.tags.delete(k); }
  }

  /** 07 §5.7: `[E] Verb` 4 px above the targeted object (items show their card instead). */
  private drawPrompt(w: GameWorld): void {
    if (!this.prompt) {
      this.prompt = this.scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.hud - 1);
      this.prompt2 = this.scene.add.bitmapText(0, 0, FONTS.small, '').setOrigin(0.5, 1).setDepth(DEPTH.hud - 1);
    }
    const tg = interactTarget(w);
    const t = tg && 'use' in tg ? tg : null;
    const p = t && !w.health.dead ? interactPrompt(w, t) : null;
    this.prompt.setVisible(!!p);
    this.prompt2!.setVisible(!!p?.l2);
    if (!p || !t) return;
    const color = p.tone === 'curse' ? HUD_COLOR.curse : UI_COLOR[p.tone];
    const top = t.y - (t.h ?? F.promptObjH) - F.promptGap;
    this.prompt2!.setText(p.l2 ?? '').setTint(UI_COLOR.textDim).setPosition(t.x, top);
    this.prompt.setText(`${p.glyph ? '[E] ' : ''}${p.l1}`).setTint(color).setPosition(t.x, p.l2 ? top - this.prompt2!.height - 1 : top);
  }

  /** Burn flames, chill frost, the freeze ice block (shatter shards when it ends), poison bubbles. */
  private drawStatuses(w: GameWorld, now: number): void {
    for (const e of w.enemies) {
      if (e.dead || !e.status) { this.frozen.delete(e.id); continue; }
      const st = e.status, r = enemyRect(e), c = enemyCenter(e);
      if (st.burn) this.loop(`burn${e.id}`, 'burn_flame', c.x, r.y + F.burnDy, now);
      if (st.chill) this.loop(`chill${e.id}`, 'chill_frost', r.x + r.w - F.statusInset, r.y + F.statusInset, now);
      if (st.poison) this.loop(`poison${e.id}`, 'poison_bubble', r.x + F.statusInset, r.y + F.statusInset, now);
      const fz = !!st.frozen;
      if (fz) {
        const s = this.loop(`freeze${e.id}`, 'freeze_block', c.x, c.y, now, DEPTH.vfx);
        s?.setDisplaySize(r.w + F.freezePad, r.h + F.freezePad).setAlpha(F.freezeAlpha);
      }
      if (this.frozen.get(e.id) && !fz) for (let i = 0; i < F.shards; i++) this.once('shatter_shards', c.x + (i - 1) * F.shardStep, c.y - (i % 2) * F.shardStep, now);
      this.frozen.set(e.id, fz);
    }
  }

  /** S-grade signature effects over their hit boxes (ART6 `sig_*`). */
  private drawSignatures(w: GameWorld, now: number): void {
    const SG = SIGNATURE;
    for (const en of w.abilityEntities) {
      const v = en.view?.() as { rect?: { x: number; y: number; w: number; h: number }; dir?: number; at?: number } | undefined;
      if (!v?.rect) continue;
      const cx = v.rect.x + v.rect.w / 2, cy = v.rect.y + v.rect.h / 2;
      if (en.kind === 'signature_wave') {
        const key = v.rect.h === SG.quake.h && v.rect.w === SG.quake.w ? 'sig_quake' : 'sig_ground_wave';
        this.loop(`sig${en.id}`, key, cx, cy, now)?.setFlipX((v.dir ?? 1) < 0);
      } else if (en.kind === 'tempest_cloud') {
        this.loop(`sig${en.id}`, 'sig_tempest', cx, cy, now)?.setDisplaySize(v.rect.w, v.rect.h);
      } else if (en.kind === 'phantom_edge' && v.at !== undefined && now >= v.at && !this.sigSeen.has(en.id)) {
        this.sigSeen.add(en.id);
        this.once('sig_phantom_edge', cx, cy, now);
      }
    }
    // Thunderclap is a one-tick blast with its own hit spec.
    for (const id of w.blasts) {
      const g = w.hitGroups.find((x) => x.id === id);
      if (!g || this.sigSeen.has(id) || g.spec !== SG.thunderclap.hit) continue;
      this.sigSeen.add(id);
      this.once('sig_thunderclap', g.rect.x + g.rect.w / 2, g.rect.y + g.rect.h / 2, now);
    }
    for (const p of w.playerProjectiles) if (p.opts.singularity) this.loop(`sing${p.id}`, 'sig_singularity', p.x, p.y, now);
  }
}
