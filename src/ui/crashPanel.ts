// Review C4: an uncaught error or rejected promise shows a plain panel instead of a frozen game.
export const CRASH_TEXT = 'Something went wrong — tap to reload';
export function crashMessage(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e) ?? String(e); } catch { return String(e); }
}
export function showCrash(text: string, doc: Document = document): HTMLElement {
  const old = doc.getElementById('crash-panel'); if (old) return old;
  const el = doc.createElement('div');
  el.id = 'crash-panel';
  el.setAttribute('role', 'alert');
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;'
    + 'background:rgba(16,18,28,.94);color:#f2ead8;font:16px monospace;text-align:center;padding:24px;cursor:pointer';
  const title = doc.createElement('div'); title.textContent = CRASH_TEXT; title.style.fontSize = '20px';
  const detail = doc.createElement('div'); detail.textContent = text; detail.style.cssText = 'opacity:.7;max-width:90vw;word-break:break-word;font-size:13px';
  el.append(title, detail);
  el.addEventListener('click', () => location.reload());
  doc.body.appendChild(el);
  return el;
}
export function installCrashPanel(w: Window = window): void {
  w.addEventListener('error', (e) => showCrash(crashMessage((e as ErrorEvent).error ?? (e as ErrorEvent).message)));
  w.addEventListener('unhandledrejection', (e) => showCrash(crashMessage((e as PromiseRejectionEvent).reason)));
}
