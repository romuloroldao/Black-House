/**
 * Legado: o tour geral do portal passou a `FeatureOnboardingPanel` + prefs em
 * `/api/alunos/me/onboarding-preferences` (id `portal-overview`).
 * Mantemos helpers para compatibilidade com cache antigo e e2e.
 */
import { readCachedPreference } from "@/lib/onboarding";

const STORAGE_KEY = "bh-student-onboarding-v2";

export function isStudentOnboardingDone(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function markStudentOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer FeatureOnboardingPanel + useFeatureOnboarding("portal-overview") */
export function hasServerOverviewPreference(alunoId: string | null | undefined): boolean {
  const pref = readCachedPreference(alunoId, "portal-overview");
  return Boolean(pref && pref.state !== "never");
}

export default function StudentOnboardingDialog() {
  return null;
}
