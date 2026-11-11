// Installable app (M12 Task 6): registers the service worker and shows "Update ready — restart to update" when a newer
// version is waiting. The page never reloads itself mid-run.
/** Inside the iPhone/Mac app (M16, Capacitor) the app carries its own files: no service worker, no update notice. */
export const isNativeApp = (w: { Capacitor?: unknown } = globalThis as { Capacitor?: unknown }): boolean => !!w.Capacitor;
/** Whether this page should register the service worker. Debug pages skip it (tests would cache 20 MB each) unless ?sw=1. */
export function shouldRegisterSw(w: { Capacitor?: unknown; navigator?: object; location?: { search: string } }): boolean {
  if (isNativeApp(w) || !w.navigator || !('serviceWorker' in w.navigator)) return false;
  const q = new URLSearchParams(w.location?.search ?? '');
  return !(q.get('debug') === '1' && q.get('sw') !== '1');
}
export function registerServiceWorker(): void {
  if (!shouldRegisterSw(window as unknown as Parameters<typeof shouldRegisterSw>[0])) return;
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'update-ready') showUpdateToast(); });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(); });
    });
  }).catch(() => { /* no offline copy; the game still runs */ });
}
export function showUpdateToast(): void {
  if (isNativeApp()) return;
  if (document.getElementById('update-toast')) return;
  const el = document.createElement('div');
  el.id = 'update-toast'; el.className = 'update-toast'; el.textContent = 'Update ready — restart to update';
  document.body.append(el);
  setTimeout(() => el.remove(), 8000);
}
