/**
 * Tipo de aparelho para o modo app (PWA). A mesma regra é replicada no script inline do index.html
 * (que marca <html data-device>) e no PostCSS (postcss.config.js), então mudanças aqui precisam ir para lá também.
 *
 * - Celular: ponteiro grosso e menor lado da tela até 767px (em pé ou deitado).
 * - Tablet: ponteiro grosso e menor lado a partir de 768px, ou iPadOS (UA "Macintosh" com toque).
 * - Computador: todo o resto. Nada do modo app roda nele.
 */
export type DeviceClass = "phone" | "tablet" | "desktop";

/** Celular em pé ou deitado (device-width/height não giram no iOS e giram no Android, por isso os dois). */
export const PHONE_MEDIA_QUERY =
  "(pointer: coarse) and (max-device-width: 767px), (pointer: coarse) and (max-device-height: 767px)";

/** Layout compacto: janela estreita (comportamento de sempre) ou celular deitado. */
export const PHONE_LAYOUT_MEDIA_QUERY = `(max-width: 767px), ${PHONE_MEDIA_QUERY}`;

export function isIPadOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || isIPadOS();
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

let cached: DeviceClass | null = null;

export function getDeviceClass(): DeviceClass {
  if (cached) return cached;
  if (typeof window === "undefined") return "desktop";
  const fromHtml = document.documentElement.dataset.device;
  if (fromHtml === "phone" || fromHtml === "tablet" || fromHtml === "desktop") {
    cached = fromHtml;
    return cached;
  }
  if (isIPadOS()) {
    cached = "tablet";
  } else if (!window.matchMedia?.("(pointer: coarse)").matches) {
    cached = "desktop";
  } else {
    cached = Math.min(window.screen.width, window.screen.height) <= 767 ? "phone" : "tablet";
  }
  return cached;
}

export const isPhone = () => getDeviceClass() === "phone";
export const isTablet = () => getDeviceClass() === "tablet";
/** Celular ou tablet: recebem instalação, splash e página offline. */
export const isTouchAppDevice = () => getDeviceClass() !== "desktop";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isPhoneLayoutNow(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.(PHONE_LAYOUT_MEDIA_QUERY).matches ?? window.innerWidth < 768;
}
