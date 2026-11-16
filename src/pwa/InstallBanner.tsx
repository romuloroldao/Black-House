import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getDeviceClass, isTouchAppDevice } from "@/lib/device";
import { countLoggedVisit } from "./install-store";
import { InstallSheet } from "./InstallSheet";
import { useInstallPrompt } from "./useInstallPrompt";

const FIRST_VISIT_DELAY_MS = 30_000;
const LOGGED_AREA = /^\/($|\?|financeiro|alunos\/|dieta\/|treino\/|report\/|aluno$|portal-aluno\/(?!blocked|access-blocked))/;

/** Altura da barra inferior do celular (quando existe), para o banner ficar acima dela. */
function useBottomNavOffset(enabled: boolean): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let observer: ResizeObserver | null = null;
    let observed: Element | null = null;
    const measure = () => {
      const nav = document.querySelector("[data-app-bottom-nav]");
      const visible = nav && nav.getBoundingClientRect().height > 0 && getComputedStyle(nav).position === "fixed";
      setOffset(visible ? Math.round(nav.getBoundingClientRect().height) : 0);
      if (nav !== observed) {
        observer?.disconnect();
        observed = nav;
        if (nav && typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(measure);
          observer.observe(nav);
        }
      }
    };
    measure();
    const interval = window.setInterval(measure, 1000);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [enabled]);
  return offset;
}

/** Convite para instalar: só na área logada, só em celular e tablet. */
export function InstallBanner() {
  const touch = isTouchAppDevice();
  const { user, authInitialized } = useAuth();
  const { pathname } = useLocation();
  const { bannerModeAvailable, dismissedRecently, sheet, install, dismiss, closeSheet } = useInstallPrompt();
  const [eligible, setEligible] = useState(false);
  const loggedIn = touch && authInitialized && !!user;
  const inLoggedArea = loggedIn && LOGGED_AREA.test(pathname);
  const phone = getDeviceClass() === "phone";
  const bottomOffset = useBottomNavOffset(touch && phone);

  useEffect(() => {
    if (!loggedIn) return;
    if (countLoggedVisit() >= 2) {
      setEligible(true);
      return;
    }
    const timer = window.setTimeout(() => setEligible(true), FIRST_VISIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [loggedIn]);

  if (!touch) return null;

  const showBanner = inLoggedArea && eligible && bannerModeAvailable && !dismissedRecently && !sheet;

  return (
    <>
      {showBanner && (
        <div
          role="region"
          aria-label="Instalar app"
          data-install-banner
          className="pwa-install-banner fixed z-[45] flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90"
          style={
            phone
              ? { left: 12, right: 12, bottom: `calc(${bottomOffset}px + 12px + ${bottomOffset ? "0px" : "env(safe-area-inset-bottom, 0px)"})` }
              : {
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "calc(100% - 32px)",
                  maxWidth: 420,
                  bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
                }
          }
        >
          <img src="/pwa/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Instalar app</p>
            <p className="text-xs leading-snug text-muted-foreground">Acesso rápido direto da sua tela inicial</p>
          </div>
          <Button size="sm" className="min-h-11 shrink-0 px-4" onClick={() => void install()}>
            Instalar
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar convite para instalar"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}
      {sheet && <InstallSheet kind={sheet} onClose={closeSheet} />}
    </>
  );
}
