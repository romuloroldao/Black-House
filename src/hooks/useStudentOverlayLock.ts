import { useEffect } from "react";

let overlayLockCount = 0;

function syncOverlayClass() {
  document.body.classList.toggle("student-overlay-open", overlayLockCount > 0);
}

/**
 * Esconde a bottom nav do portal aluno enquanto um sheet/dialog está aberto.
 * Suporta múltiplos overlays simultâneos (contador).
 */
export function useStudentOverlayLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    overlayLockCount += 1;
    syncOverlayClass();

    return () => {
      overlayLockCount = Math.max(0, overlayLockCount - 1);
      syncOverlayClass();
    };
  }, [active]);
}
