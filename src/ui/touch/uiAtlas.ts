// The `ui` atlas for the DOM (touch buttons, the turn-sideways screen): frames as CSS backgrounds or masks.
// White frames (the ART10 `touch_*` art) are drawn as a mask over a colored box, so the game can tint them.
export interface UiFrame { x: number; y: number; w: number; h: number }
let frames: Record<string, UiFrame> = {};
let size = { w: 1, h: 1 };
let url = '';
const waiting: (() => void)[] = [];

export function loadUiAtlas(): void {
  if (url) return;
  url = new URL('assets/ui/ui.png', document.baseURI).href;
  fetch(new URL('assets/ui/ui.json', document.baseURI)).then((r) => r.json()).then((j) => {
    frames = Object.fromEntries(Object.entries(j.frames as Record<string, { frame: UiFrame }>).map(([k, v]) => [k, v.frame]));
    size = j.meta.size; for (const f of waiting.splice(0)) f();
  }).catch(() => {});
}
export const uiFrame = (name: string): UiFrame | undefined => frames[name];
export const onUiAtlas = (fn: () => void): void => { if (Object.keys(frames).length) fn(); else waiting.push(fn); };

/** `mask:` CSS for a box of `px` CSS pixels showing this frame (an empty string until the atlas has loaded). */
export function maskCss(name: string, px: number): string {
  const f = frames[name]; if (!f) return '';
  const k = px / f.w, m = `url(${url}) ${-f.x * k}px ${-f.y * k}px / ${size.w * k}px ${size.h * k}px no-repeat`;
  return `-webkit-mask:${m};mask:${m};image-rendering:pixelated;`;
}
/** `background:` CSS for a colored frame (weapon and ability icons) at `px` wide. */
export function backgroundCss(name: string | null, px: number): string {
  const f = name ? frames[name] : undefined; if (!f) return 'background-image:none;';
  const k = px / f.w;
  return `background:url(${url}) ${-f.x * k}px ${-f.y * k}px / ${size.w * k}px ${size.h * k}px no-repeat;image-rendering:pixelated;`;
}
