/**
 * Estado do convite para instalar (celular e tablet). Começa a ouvir o beforeinstallprompt cedo
 * (importado no main.tsx), antes do login, para não perder o evento.
 */
import { toast } from "sonner";
import { getDeviceClass, isAndroid, isIOS, isIPadOS, isStandalone, isTouchAppDevice } from "@/lib/device";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * native: Android/Chrome/Edge/Samsung com o evento guardado.
 * ios-safari: passo a passo do Compartilhar.
 * open-in-safari / open-in-chrome: navegador que não instala (Chrome no iOS, Instagram, WhatsApp, Facebook...).
 * android-manual: navegador Android que instala pelo menu mas não disparou o evento.
 */
export type InstallMode = "native" | "ios-safari" | "open-in-safari" | "open-in-chrome" | "android-manual" | "unsupported";
export type InstallSheet = Exclude<InstallMode, "native" | "unsupported">;

export const INSTALLED_KEY = "bh-pwa-installed";
export const DISMISSED_AT_KEY = "bh-pwa-install-dismissed-at";
export const VISITS_KEY = "bh-pwa-logged-visits";
export const VISIT_COUNTED_KEY = "bh-pwa-visit-counted";
export const DISMISS_DAYS = 30;

const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|LinkedInApp|Twitter/i;
const IOS_NON_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YaBrowser|DuckDuckGo|Brave|Mercury/i;
const ANDROID_INSTALL_CAPABLE = /Chrome\/|SamsungBrowser|EdgA|Firefox/i;

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  sheet: InstallSheet | null;
}

let state: InstallState = { deferred: null, installed: false, sheet: null };
const listeners = new Set<() => void>();

function set(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getInstallState = () => state;

function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function resolveInstallMode(s: InstallState = state): InstallMode {
  if (!isTouchAppDevice()) return "unsupported";
  const ua = navigator.userAgent;
  if (isIOS()) {
    return IN_APP_BROWSER.test(ua) || IOS_NON_SAFARI.test(ua) ? "open-in-safari" : "ios-safari";
  }
  if (s.deferred) return "native";
  if (isAndroid()) {
    if (IN_APP_BROWSER.test(ua) || /; wv\)/.test(ua)) return "open-in-chrome";
    return ANDROID_INSTALL_CAPABLE.test(ua) ? "android-manual" : "open-in-chrome";
  }
  return "unsupported";
}

export function isAppInstalled(s: InstallState = state): boolean {
  return s.installed || isStandalone();
}

export function isDismissedRecently(now = Date.now()): boolean {
  const raw = Number(readFlag(DISMISSED_AT_KEY));
  return Number.isFinite(raw) && raw > 0 && now - raw < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function dismissBanner() {
  writeFlag(DISMISSED_AT_KEY, String(Date.now()));
  set({});
}

/** Conta acessos logados: uma vez por sessão do navegador. */
export function countLoggedVisit(): number {
  let visits = Number(readFlag(VISITS_KEY)) || 0;
  try {
    if (sessionStorage.getItem(VISIT_COUNTED_KEY) !== "1") {
      visits += 1;
      writeFlag(VISITS_KEY, String(visits));
      sessionStorage.setItem(VISIT_COUNTED_KEY, "1");
    }
  } catch {
    /* ignore */
  }
  return visits;
}

export function closeInstallSheet() {
  set({ sheet: null });
}

/** Abre o fluxo de instalação certo para o aparelho (banner e item "Instalar app" usam este). */
export async function requestInstall(): Promise<void> {
  const mode = resolveInstallMode();
  if (mode === "unsupported") return;
  if (mode !== "native") {
    set({ sheet: mode });
    return;
  }
  const event = state.deferred;
  if (!event) return;
  set({ deferred: null });
  try {
    await event.prompt();
    await event.userChoice;
  } catch {
    /* o navegador recusou abrir o prompt */
  }
}

let initialized = false;

export function initInstallPrompt() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  if (getDeviceClass() === "desktop") return;

  state = { ...state, installed: isStandalone() || readFlag(INSTALLED_KEY) === "1" };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    writeFlag(INSTALLED_KEY, null);
    set({ deferred: e as BeforeInstallPromptEvent, installed: isStandalone() });
  });

  window.addEventListener("appinstalled", () => {
    writeFlag(INSTALLED_KEY, "1");
    set({ installed: true, deferred: null, sheet: null });
    toast.success("App instalado");
  });

  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  if (typeof nav.getInstalledRelatedApps === "function") {
    nav
      .getInstalledRelatedApps()
      .then((apps) => {
        if (Array.isArray(apps) && apps.length > 0) set({ installed: true });
      })
      .catch(() => undefined);
  }
}

export function isIPadDevice(): boolean {
  return isIPadOS() || /iPad/.test(navigator.userAgent);
}
