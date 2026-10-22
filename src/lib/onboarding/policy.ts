import type { OnboardingPreference, ShouldAutoShowInput } from "./types";

/**
 * Decide se o tutorial deve auto-abrir.
 * completed/skipped: não auto-exibem na mesma versão.
 * dismissed_permanently: nunca auto-exibe, mesmo com forceReshow.
 * never / ausência: auto-exibe.
 * in_progress: auto-exibe (retomar).
 * Versão maior + forceReshow: reabre só se não dismiss permanente.
 */
export function shouldAutoShowOnboarding(input: ShouldAutoShowInput): boolean {
  if (input.blocked) return false;
  const pref = input.preference;
  const def = input.definition;

  if (!pref) return true;

  if (pref.dismiss_permanently || pref.state === "dismissed_permanently") {
    return false;
  }

  if (pref.version < def.version && def.forceReshowOnVersionBump) {
    return true;
  }

  if (pref.state === "never" || pref.state === "in_progress") {
    return true;
  }

  return false;
}

export function nextStepIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(0, current), total - 1);
}

export function defaultPreference(onboardingId: string, version: number): OnboardingPreference {
  return {
    onboarding_id: onboardingId,
    version,
    state: "never",
    dismiss_permanently: false,
    current_step: 0,
  };
}
