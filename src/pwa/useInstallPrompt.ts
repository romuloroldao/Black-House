import { useSyncExternalStore } from "react";
import { isTouchAppDevice } from "@/lib/device";
import {
  closeInstallSheet,
  dismissBanner,
  getInstallState,
  isAppInstalled,
  isDismissedRecently,
  requestInstall,
  resolveInstallMode,
  subscribeInstall,
} from "./install-store";

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribeInstall, getInstallState, getInstallState);
  const touch = isTouchAppDevice();
  const mode = resolveInstallMode(state);
  const installed = isAppInstalled(state);
  const canInstall = touch && !installed && mode !== "unsupported";
  return {
    mode,
    installed,
    /** Item fixo "Instalar app" do menu: nunca no computador, some quando já instalado. */
    canShowMenuItem: canInstall,
    /** Banner: só onde há um fluxo direto (Android com o evento guardado, iOS e navegadores que não instalam). */
    bannerModeAvailable: canInstall && mode !== "android-manual",
    dismissedRecently: isDismissedRecently(),
    sheet: state.sheet,
    install: requestInstall,
    dismiss: dismissBanner,
    closeSheet: closeInstallSheet,
  };
}
