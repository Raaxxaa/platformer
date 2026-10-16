// M3 stage scene: loads public/levels/<id>.json and plays it, with doors, loot markers, hints, the boss bar,
// the run timer, the split popup and the temporary stage-clear screen.
import Phaser from 'phaser';
import { killEnemy } from '../../core/combat/resolve.ts';
import { loadLevel, type LevelData } from '../../core/level/loadLevel.ts';
import { sectionAt } from '../../core/level/routeLint.ts';
import { timedDoorTimeLeft } from '../../core/run/timedDoors.ts';
import type { HintAction } from '../../core/run/zones.ts';
import { GameWorld } from '../../core/sim/gameWorld.ts';
import { formatTime } from '../../core/time.ts';
import { TICK_RATE } from '../../core/tuning.ts';
import { DEPTH } from '../../data/art.ts';
import { STAGE_UI } from '../../data/stageUi.ts';
import { WorldScene } from './WorldScene.ts';

/** Hint text with the M1 key names (07 shows real button prompts later). */
const HINT_TEXT: Record<HintAction, string> = {
  move: 'A / D — move', jump: 'Space — jump', double_jump: 'Space in the air — double jump', dash: 'Shift — dash (through attacks)',
  wall_jump: 'Space on a wall — wall jump', slide: 'S + Shift — slide', dive_slam: 'S + J in the air — dive slam',
  attack: 'J / K — attack', lucky_block: 'Hit the block!', ability: 'U / I — ability', heal: 'Q — drink the flask',
  interact: 'E — pick up', drop_through: 'S + Space — drop through',
};
/** Grey marker letters for loot objects that start working in M4. */
const MARKER_LETTER: Record<string, string> = {
  lucky_block: 'L', loot_stand: 'S', key: 'K', key_chest: 'C', cursed_chest: 'Q', timed_chest: 'T', merchant_spot: 'M',
};
const CENTER_MARKERS = new Set(['lucky_block', 'key']);

/** A random 8-character seed (06 §7.1), made here so the core never sees `Math.random`. */
function randomSeed(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export class StageScene extends WorldScene {
  private levelId = 'plains';
  private level!: LevelData;
  private props!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private doorText = new Map<string, Phaser.GameObjects.Text>();
  private hintText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private splitText!: Phaser.GameObjects.Text;
  private splitUntil = -1;
  private bossBarGfx!: Phaser.GameObjects.Graphics;
  private bossText!: Phaser.GameObjects.Text;
  private clearOverlay!: Phaser.GameObjects.Graphics;
  private clearText!: Phaser.GameObjects.Text;

  constructor() {
    super('Stage');
  }

  preload(): void {
    super.preload();
    const q = new URLSearchParams(window.location.search);
    this.levelId = (q.get('debug') === '1' && q.get('start')) || 'plains';
    this.load.json(`level_${this.levelId}`, `levels/${this.levelId}.json`);
  }

  protected makeWorld(): GameWorld {
    this.level = loadLevel(this.cache.json.get(`level_${this.levelId}`));
    const q = new URLSearchParams(window.location.search);
    const seed = (q.get('debug') === '1' && q.get('seed')?.toUpperCase()) || randomSeed();
    const w = GameWorld.fromLevel(this.level, { seedText: seed });
    const section = q.get('debug') === '1' ? Number(q.get('section') ?? 0) : 0;
    if (section > 0) {
      // 06 §16: the player goes to the first main_path vertex inside section n.
      const p = this.level.objects.find((o) => o.type === 'main_path')?.points?.find((v) => sectionAt(this.level, v.x, v.y) === section);
      if (p) w.teleportPlayer(p.x, Math.floor(p.y / 16) * 16 + 16);
    }
    return w;
  }

  protected createExtra(): void {
    const U = STAGE_UI;
    const { width, height } = this.scale;
    this.props = this.add.graphics().setDepth(DEPTH.terrain + 5);
    for (const m of this.world.markers) {
      const y = CENTER_MARKERS.has(m.type) ? m.y + U.marker / 2 : m.y;
      this.labels.push(this.add.text(m.x, y - U.marker / 2, MARKER_LETTER[m.type] ?? '?', { fontFamily: 'monospace', fontSize: '9px', color: '#ffffff' })
        .setOrigin(0.5).setDepth(DEPTH.terrain + 6));
    }
    const ui = { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', stroke: '#0d0b14', strokeThickness: 2 };
    this.hintText = this.add.text(width / 2, height - U.hintBottom, '', ui).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH.hud);
    this.timerText = this.add.text(width - 4, 4, '', { ...ui, fontSize: '12px' }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.splitText = this.add.text(width - 4, 20, '', { ...ui, color: '#ffd84a' }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.bossBarGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.bossText = this.add.text(width / 2, U.bossBarY - 2, '', ui).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH.hud);
    this.clearOverlay = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 5);
    this.clearOverlay.fillStyle(0x000000, 0.6).fillRect(0, 0, width, height);
    this.clearText = this.add.text(width / 2, height / 2, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.hud + 6);
    this.installStageDebug();
  }

  private installStageDebug(): void {
    const api = window.__game as unknown as Record<string, unknown> | undefined;
    if (!api) return;
    api.runState = () => structuredClone(this.world.run);
    api.killAll = () => { for (const e of this.world.enemies) if (!e.dead && !e.dormant && e.spawnInTicks === 0) killEnemy(this.world, e); };
    api.setBossHp = (hp: number) => { const b = this.world.enemies.find((e) => e.boss); if (b) b.hp = hp; };
    api.levelId = () => this.level.id;
    // Zooms out to show section n whole (0 = back to normal), for screenshots.
    api.overview = (n: number) => {
      const s = this.level.objects.find((o) => o.type === 'section' && o.props.index === n);
      const rows = this.level.objects.filter((o) => o.type === 'main_path')[0]?.points ?? [];
      const ys = rows.filter((p) => s && p.x >= s.x && p.x < s.x + s.w).map((p) => p.y);
      const top = Math.max(0, Math.min(...ys) - STAGE_UI.overviewAbove * 16), bottom = Math.min(this.world.grid.heightPx, Math.max(...ys) + STAGE_UI.overviewBelow * 16);
      this.overview = n > 0 && s ? { x: s.x, y: top, w: s.w, h: Math.max(bottom - top, (s.w * 9) / 16) } : null;
    };
    api.arenas = () => [...this.world.arenas.values()].map((a) => ({ id: a.id, kind: a.kind, rect: a.rect }));
  }

  protected hudLines(): string[] {
    return super.hudLines().filter((l) => !l.startsWith('Time'));
  }

  protected renderExtra(): void {
    const w = this.world, U = STAGE_UI;
    const g = this.props.clear();
    // Doors and other bodies.
    for (const b of w.bodies.list) {
      if (b.id.startsWith('arena_door') || w.timedDoors.some((t) => t.id === b.id)) {
        const timed = w.timedDoors.find((t) => t.id === b.id);
        const state = timed ? w.run.timedDoors[b.id] : null;
        const color = state === 'missed' ? U.doorMissed : state === 'open' ? U.doorOpen : b.active ? U.doorActive : U.door;
        if (b.active) g.fillStyle(color, 1).fillRect(b.x, b.y, b.w, b.h);
        else g.lineStyle(1, color, 1).strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        if (timed) {
          let t = this.doorText.get(b.id);
          if (!t) { t = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '9px', color: '#ffffff', stroke: '#0d0b14', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(DEPTH.terrain + 6); this.doorText.set(b.id, t); }
          t.setPosition(b.x + b.w / 2, b.y - 2).setText(state === 'pending' ? `${Math.ceil(timedDoorTimeLeft(w, b.id))}` : '');
        }
      }
    }
    // Loot markers (grey boxes with a letter) and guide arrows.
    for (const m of w.markers) {
      const cy = CENTER_MARKERS.has(m.type) ? m.y : m.y - U.marker / 2;
      g.fillStyle(U.markerColor, 1).fillRect(m.x - U.marker / 2, cy - U.marker / 2, U.marker, U.marker);
    }
    for (const a of this.level.objects.filter((o) => o.type === 'guide_arrow')) {
      const ang = (Number(a.props.angle ?? 0) * Math.PI) / 180, L = U.arrowLen;
      const tx = a.x + Math.cos(ang) * L / 2, ty = a.y + Math.sin(ang) * L / 2;
      g.lineStyle(2, 0xffffff, 1).lineBetween(a.x - Math.cos(ang) * L / 2, a.y - Math.sin(ang) * L / 2, tx, ty);
      g.fillStyle(0xffffff, 1).fillTriangle(tx + Math.cos(ang) * 4, ty + Math.sin(ang) * 4,
        tx + Math.cos(ang + 2.4) * 6, ty + Math.sin(ang + 2.4) * 6, tx + Math.cos(ang - 2.4) * 6, ty + Math.sin(ang - 2.4) * 6);
    }
    // Hint, timer, split popup, boss bar, stage clear.
    this.hintText.setText(w.activeHint && !this.overview ? HINT_TEXT[w.activeHint] : '');
    this.timerText.setVisible(!this.overview);
    this.timerText.setText(formatTime(w.run.runTicks));
    for (const { e } of this.frameEvents) if (e.t === 'split') { this.splitUntil = w.tick + U.splitSeconds * TICK_RATE; this.splitText.setText(`Split ${e.index}  ${formatTime(e.runTicks)}`); }
    this.splitText.setVisible(w.tick < this.splitUntil);
    const bar = w.bossBar;
    const bg = this.bossBarGfx.clear();
    if (bar) {
      const x0 = (this.scale.width - U.bossBarW) / 2;
      bg.fillStyle(0x0d0b14, 0.8).fillRect(x0 - 1, U.bossBarY - 1, U.bossBarW + 2, U.bossBarH + 2);
      bg.fillStyle(0xe04040, 1).fillRect(x0, U.bossBarY, Math.round((U.bossBarW * bar.hp) / bar.maxHp), U.bossBarH);
      for (const m of bar.marks) bg.fillStyle(0xffffff, 1).fillRect(x0 + Math.round(U.bossBarW * m), U.bossBarY, 1, U.bossBarH);
      this.bossText.setText(`${bar.name} — ${bar.title}`);
    } else this.bossText.setText('');
    const clear = w.run.phase === 'stageClear';
    this.clearOverlay.setVisible(clear);
    this.clearText.setVisible(clear).setText(`Stage 1 clear — ${formatTime(w.run.runTicks)}\n\nPress R to run again`);
  }
}
