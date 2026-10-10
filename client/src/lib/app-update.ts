// Ask the service worker for a newer deployed build; if one installs, reload once onto it.
// The PWA registers with registerType 'autoUpdate', so a new worker activates and takes control by itself.
export async function checkForAppUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  try {
    await registration.update();
  } catch {
    return; // offline or the worker script is unreachable: keep the current version
  }
  const incoming = registration.installing ?? registration.waiting;
  if (!incoming) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
