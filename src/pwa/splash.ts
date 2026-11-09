// Must match the listener of the inline splash in index.html.
export const APP_READY_EVENT = "bh:app-ready";

let signaled = false;

export function signalAppReady(): void {
  if (signaled || typeof window === "undefined") return;
  signaled = true;
  window.dispatchEvent(new Event(APP_READY_EVENT));
}
