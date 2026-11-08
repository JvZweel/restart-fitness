import { signal } from '@preact/signals';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void> }
export const installPrompt = signal<BeforeInstallPromptEvent | null>(null);
export const offlineReady = signal(false);

export function initPwa(): void {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt.value = e as BeforeInstallPromptEvent; });
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then((reg) => {
    const check = () => { if (navigator.serviceWorker.controller || reg.active) offlineReady.value = true; };
    check();
    navigator.serviceWorker.ready.then(() => { offlineReady.value = true; });
    reg.addEventListener('updatefound', check);
  }).catch(() => undefined);
}
