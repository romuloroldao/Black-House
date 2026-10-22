/** Telemetria leve de onboarding (CustomEvent; sem PII / saúde / conteúdo). */

export type OnboardingAnalyticsEvent =
  | "onboarding_eligible"
  | "onboarding_viewed"
  | "onboarding_step_viewed"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "onboarding_dismissed_permanently"
  | "onboarding_reopened";

export function trackOnboardingEvent(
  name: OnboardingAnalyticsEvent,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  const detail = { name, props: props || {}, at: new Date().toISOString() };
  try {
    window.dispatchEvent(new CustomEvent("blackhouse:onboarding-analytics", { detail }));
  } catch {
    /* ignore */
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[onboarding-analytics]", detail);
  }
}
