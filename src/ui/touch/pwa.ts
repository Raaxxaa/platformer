// Installable app (M12 Task 6): registers the service worker and shows "Update ready — restart to update" when a newer
// version is waiting. The page never reloads itself mid-run.
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const q = new URLSearchParams(window.location.search);
  // Debug pages skip it (tests would cache 20 MB each) unless asked with ?sw=1.
  if (q.get('debug') === '1' && q.get('sw') !== '1') return;
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'update-ready') showUpdateToast(); });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(); });
    });
  }).catch(() => { /* no offline copy; the game still runs */ });
}
export function showUpdateToast(): void {
  if (document.getElementById('update-toast')) return;
  const el = document.createElement('div');
  el.id = 'update-toast'; el.className = 'update-toast'; el.textContent = 'Update ready — restart to update';
  document.body.append(el);
  setTimeout(() => el.remove(), 8000);
}
