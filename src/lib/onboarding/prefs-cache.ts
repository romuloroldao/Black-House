import type { OnboardingPreference, OnboardingState } from "./types";

const PREFIX = "bh-onboarding-pref";

function key(alunoId: string, onboardingId: string): string {
  return `${PREFIX}:${alunoId}:${onboardingId}`;
}

export function readCachedPreference(
  alunoId: string | null | undefined,
  onboardingId: string,
): OnboardingPreference | null {
  if (!alunoId) return null;
  try {
    const raw = localStorage.getItem(key(alunoId, onboardingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingPreference;
    if (!parsed?.onboarding_id || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedPreference(
  alunoId: string | null | undefined,
  pref: OnboardingPreference,
): void {
  if (!alunoId) return;
  try {
    localStorage.setItem(key(alunoId, pref.onboarding_id), JSON.stringify(pref));
  } catch {
    /* ignore quota */
  }
}

/** Migração one-shot do tour legado (sem aluno id no key antigo). */
export function migrateLegacyOverviewDone(alunoId: string | null | undefined): OnboardingPreference | null {
  if (!alunoId) return null;
  try {
    if (localStorage.getItem("bh-student-onboarding-v2") !== "1") return null;
    const existing = readCachedPreference(alunoId, "portal-overview");
    if (existing && existing.state !== "never") return existing;
    const pref: OnboardingPreference = {
      onboarding_id: "portal-overview",
      version: 1,
      state: "completed" as OnboardingState,
      dismiss_permanently: false,
      current_step: 0,
      completed_at: new Date().toISOString(),
    };
    writeCachedPreference(alunoId, pref);
    return pref;
  } catch {
    return null;
  }
}
