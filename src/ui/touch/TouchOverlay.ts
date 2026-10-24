// The touch controls (07 §8.6): plain DOM above the game canvas, finger-sized at any game scale. It listens for touch
// pointers on the window (so taps on menus still reach the canvas), feeds the TouchModel, and draws the stick, buttons,
// live icons, cooldown shades, the Interact word and the Pause hold ring. No Phaser here.
import { TOUCH as T } from '../../data/touch.ts';
import type { TouchSettings } from '../../core/save/schema.ts';
import { getUiSettings, lastDeviceIsTouch, noteInputDevice } from '../inputSettings.ts';
import { touchModel } from './touchInput.ts';
import type { TouchButtonId } from './touchModel.ts';
import type { TouchHudView, TouchSlotView } from './touchView.ts';
import './touch.css';

const HEX = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
type Atlas = Record<string, { frame: { x: number; y: number; w: number; h: number } }>;

/** Shapes for the buttons until ART10's `touch_*` frames land (07 §8.6 Look). */
const GLYPH: Partial<Record<TouchButtonId, string>> = { jump: '▲', dash: '»', heal: '', interact: '', pause: '❚❚' };

export class TouchOverlay {
  private readonly root = document.createElement('div');
  private readonly stickRing = document.createElement('div');
  private readonly stickKnob = document.createElement('div');
  private readonly hint = document.createElement('div');
  private readonly ring = document.createElement('div');
  private readonly els = new Map<TouchButtonId, { el: HTMLDivElement; icon: HTMLDivElement; shade: HTMLDivElement; label: HTMLSpanElement; word: HTMLSpanElement }>();
  private atlas: Atlas = {};
  private atlasUrl = '';
  private settings!: TouchSettings;
  private view: TouchHudView | null = null;
  /** Gameplay is running (not a menu): the controls work and are drawn. Menus take taps directly. */
  private gameplay = false;
  private editing = false;
  private settingsKey = '';

  constructor(parent: HTMLElement = document.body) {
    this.root.id = 'touch'; this.root.className = 'touch-root';
    this.stickRing.className = 'touch-ring'; this.stickKnob.className = 'touch-knob'; this.hint.className = 'touch-hint'; this.ring.className = 'touch-hold';
    this.root.append(this.hint, this.stickRing, this.stickKnob, this.ring);
    for (const def of T.buttons) {
      const el = document.createElement('div'); el.className = `touch-btn touch-${def.id}`;
      const icon = document.createElement('div'); icon.className = 'touch-icon';
      const shade = document.createElement('div'); shade.className = 'touch-shade';
      const label = document.createElement('span'); label.className = 'touch-label'; label.textContent = GLYPH[def.id] ?? '';
      const word = document.createElement('span'); word.className = 'touch-word';
      el.append(icon, shade, label, word); this.root.append(el);
      this.els.set(def.id, { el, icon, shade, label, word });
    }
    parent.append(this.root);
    this.setSettings(touchModel.settings);
    window.addEventListener('pointerdown', this.onDown, { capture: true });
    window.addEventListener('pointermove', this.onMove, { capture: true });
    window.addEventListener('pointerup', this.onUp, { capture: true });
    window.addEventListener('pointercancel', this.onCancel, { capture: true });
    window.addEventListener('resize', this.onResize); window.addEventListener('orientationchange', this.onResize);
    window.addEventListener('blur', () => touchModel.releaseAll());
    // No long-press menu, text selection or double-tap zoom (07 §8.6 page setup).
    window.addEventListener('contextmenu', (e) => { if (lastDeviceIsTouch()) e.preventDefault(); });
    this.onResize();
    this.loadAtlas();
    const frame = () => { this.draw(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }

  private loadAtlas(): void {
    this.atlasUrl = new URL('assets/ui/ui.png', document.baseURI).href;
    fetch(new URL('assets/ui/ui.json', document.baseURI)).then((r) => r.json()).then((j) => { this.atlas = j.frames as Atlas; }).catch(() => {});
  }
  setSettings(s: TouchSettings): void { this.settings = s; touchModel.setSettings(s); this.root.style.setProperty('--touch-opacity', String(s.opacity / 100)); }
  /** The game says whether a run is being played (true) or a menu has the screen (false). */
  setGameplay(on: boolean): void {
    if (this.gameplay && !on) touchModel.releaseAll();
    this.gameplay = on;
  }
  setView(v: TouchHudView | null): void { this.view = v; touchModel.setInteract(!!v?.interact); }
  setEditing(on: boolean): void { this.editing = on; }

  /** Overlay drawn: `On`, or `Auto` after the first touch until a key or pad press (07 §8.6 When shown). */
  get visible(): boolean {
    const m = this.settings.mode;
    return m === 'on' || (m === 'auto' && lastDeviceIsTouch());
  }
  private get live(): boolean { return this.visible && this.gameplay && !this.editing; }

  private readonly onResize = () => {
    const cs = getComputedStyle(document.documentElement);
    const inset = (n: string) => parseFloat(cs.getPropertyValue(n)) || 0;
    touchModel.setScreen(window.innerWidth, window.innerHeight);
    touchModel.setSafe({ l: inset('--sa-l'), r: inset('--sa-r'), t: inset('--sa-t'), b: inset('--sa-b') });
  };

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    noteInputDevice('touch');
    if (this.live) { touchModel.pointerDown(e.pointerId, e.clientX, e.clientY, performance.now()); }
  };
  private readonly onMove = (e: PointerEvent) => { if (this.live && (e.pointerType === 'touch' || e.pointerType === 'pen')) { e.preventDefault(); touchModel.pointerMove(e.pointerId, e.clientX, e.clientY); } };
  private readonly onUp = (e: PointerEvent) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') touchModel.pointerUp(e.pointerId, e.clientX, e.clientY, performance.now()); };
  private readonly onCancel = (e: PointerEvent) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') touchModel.pointerCancel(e.pointerId, performance.now()); };

  private paintIcon(el: HTMLDivElement, frame: string | null): void {
    const f = frame ? this.atlas[frame]?.frame : null;
    if (!f) { el.style.backgroundImage = 'none'; return; }
    const px = 'calc(var(--u) * 0.62)', k = `calc(${px} / ${f.w})`;
    el.style.backgroundImage = `url(${this.atlasUrl})`;
    el.style.backgroundSize = `calc(${k} * 974) calc(${k} * 160)`;
    el.style.backgroundPosition = `calc(${k} * -${f.x}) calc(${k} * -${f.y})`;
    el.style.width = px; el.style.height = px;
  }

  private draw(): void {
    const key = JSON.stringify(getUiSettings().touch);
    if (key !== this.settingsKey) { this.settingsKey = key; this.setSettings(getUiSettings().touch); }
    const show = this.visible && (this.gameplay || this.editing);
    this.root.style.display = show ? 'block' : 'none';
    if (!show) return;
    const u = touchModel.unit();
    this.root.style.setProperty('--u', `${u}px`);
    const now = performance.now(), views = this.view;
    const rects = touchModel.rects(), byId = new Map(rects.map((r) => [r.id, r]));
    for (const [id, o] of this.els) {
      const r = byId.get(id);
      o.el.style.display = r ? 'flex' : 'none';
      if (!r) continue;
      o.el.style.left = `${r.cx - r.r}px`; o.el.style.top = `${r.cy - r.r}px`; o.el.style.width = `${r.r * 2}px`; o.el.style.height = `${r.r * 2}px`;
      o.el.classList.toggle('held', touchModel.isHeld(id));
      const slot: TouchSlotView | null = !views ? null : id === 'attack1' ? views.attack1 : id === 'attack2' ? views.attack2 : id === 'ability1' ? views.ability1 : id === 'ability2' ? views.ability2 : null;
      if (slot) {
        this.paintIcon(o.icon, slot.icon);
        o.el.style.borderColor = slot.ring !== null && !touchModel.isHeld(id) ? HEX(slot.ring) : '';
        o.el.classList.toggle('dim', slot.dim);
        o.shade.style.height = `${Math.round(slot.shade * 100)}%`;
        o.label.textContent = slot.shade > 0 ? String(slot.seconds) : slot.maxCharges > 1 ? String(slot.charges) : '';
      }
      if (id === 'heal') o.label.textContent = views ? String(views.heal) : '';
      if (id === 'interact') o.word.textContent = views?.interact ?? '';
    }
    // Stick: faint hint circle while untouched, ring and knob while held.
    const s = touchModel.stick, u1 = u;
    const hx = this.settings.leftHanded ? window.innerWidth - touchModel.safe.r - T.stickHint[0] * u1 : touchModel.safe.l + T.stickHint[0] * u1;
    this.hint.style.cssText = `display:${s ? 'none' : 'block'};left:${hx - 1.1 * u1}px;top:${window.innerHeight - touchModel.safe.b - T.stickHint[1] * u1 - 1.1 * u1}px;width:${2.2 * u1}px;height:${2.2 * u1}px`;
    this.stickRing.style.display = this.stickKnob.style.display = s ? 'block' : 'none';
    if (s) {
      this.stickRing.style.cssText = `display:block;left:${s.cx - s.r}px;top:${s.cy - s.r}px;width:${s.r * 2}px;height:${s.r * 2}px`;
      this.stickKnob.style.cssText = `display:block;left:${s.kx - 0.45 * u1}px;top:${s.ky - 0.45 * u1}px;width:${0.9 * u1}px;height:${0.9 * u1}px`;
    }
    // The Pause hold ring (07 §4.13): fills toward the 0.5 s restart.
    const hold = touchModel.pauseHold(now), p = byId.get('pause');
    this.ring.style.display = hold > 0 && p ? 'block' : 'none';
    if (hold > 0 && p) this.ring.style.cssText = `display:block;left:${p.cx - p.r - 4}px;top:${p.cy - p.r - 4}px;width:${p.r * 2 + 8}px;height:${p.r * 2 + 8}px;background:conic-gradient(var(--hl) ${hold * 360}deg, transparent 0)`;
  }
  destroy(): void { this.root.remove(); }
}
