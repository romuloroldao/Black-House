import type { Workbox } from "workbox-window";
import { isTouchAppDevice } from "@/lib/device";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let wb: Workbox | null = null;
let updateWaiting = false;
const updateListeners = new Set<() => void>();

/** Avisa quando há versão nova esperando. Chama na hora se já houver. */
export function subscribeToUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  if (updateWaiting) listener();
  return () => {
    updateListeners.delete(listener);
  };
}

/** Ativa a versão nova e recarrega só esta aba (as outras seguem com a versão antiga até recarregarem). */
export function applyUpdate(): void {
  if (!wb) return;
  wb.addEventListener("controlling", () => window.location.reload());
  wb.messageSkipWaiting();
}

async function unregisterAllAndClearCaches(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }
}

/**
 * Produção: registra /sw.js. Desenvolvimento: desregistra qualquer service worker que tenha sobrado
 * e limpa os caches, para nunca servir código velho no `vite dev`.
 */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    if (!import.meta.env.PROD) {
      await unregisterAllAndClearCaches();
      return;
    }
    const { Workbox } = await import("workbox-window");
    wb = new Workbox("/sw.js", { scope: "/" });
    wb.addEventListener("waiting", () => {
      updateWaiting = true;
      updateListeners.forEach((l) => l());
    });
    await wb.register();

    // Celular e tablet costumam ficar dias com o app aberto: procuram versão nova de hora em hora e ao voltar para o app.
    if (isTouchAppDevice()) {
      const check = () => {
        wb?.update().catch(() => undefined);
      };
      window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    }
  } catch (error) {
    console.warn("[pwa] service worker não registrado", error);
  }
}
