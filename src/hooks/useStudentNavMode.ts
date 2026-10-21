/**
 * Preferência de navegação do portal aluno: compact (só ícones) | expanded.
 * Padrão: compact — Agent First.
 * Persistência: localStorage (safe-storage). Backend de UI prefs ainda não existe.
 */
import { useCallback, useEffect, useState } from "react";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

export type StudentNavMode = "compact" | "expanded";

export const STUDENT_NAV_MODE_KEY = "bh-student-nav-mode";

export function readStudentNavMode(): StudentNavMode {
  const raw = safeGetItem(STUDENT_NAV_MODE_KEY);
  if (raw === "expanded" || raw === "compact") return raw;
  return "compact";
}

export function useStudentNavMode() {
  const [mode, setModeState] = useState<StudentNavMode>(() =>
    typeof window !== "undefined" ? readStudentNavMode() : "compact",
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STUDENT_NAV_MODE_KEY) return;
      if (e.newValue === "expanded" || e.newValue === "compact") {
        setModeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((next: StudentNavMode) => {
    setModeState(next);
    safeSetItem(STUDENT_NAV_MODE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "compact" ? "expanded" : "compact");
  }, [mode, setMode]);

  return {
    mode,
    setMode,
    toggle,
    isCompact: mode === "compact",
    isExpanded: mode === "expanded",
  };
}
