/** Telemetria leve de onboarding (CustomEvent + POST opcional; sem PII / saúde / conteúdo). */

import { apiClient } from "@/lib/api-client";

export type OnboardingAnalyticsEvent =
  | "onboarding_eligible"
  | "onboarding_viewed"
  | "onboarding_step_viewed"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "onboarding_dismissed_permanently"
  | "onboarding_reopened";

const EVENT_TO_SERVER: Record<OnboardingAnalyticsEvent, string> = {
  onboarding_eligible: "eligible",
  onboarding_viewed: "viewed",
  onboarding_step_viewed: "step_viewed",
  onboarding_completed: "completed",
  onboarding_skipped: "skipped",
  onboarding_dismissed_permanently: "dismissed_permanently",
  onboarding_reopened: "reopened",
};

/** Estados terminais já são gravados no PUT de preferências — evita duplicar. */
const SKIP_SERVER_POST = new Set<OnboardingAnalyticsEvent>([
  "onboarding_completed",
  "onboarding_skipped",
  "onboarding_dismissed_permanently",
]);

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

  if (SKIP_SERVER_POST.has(name)) return;
  const onboardingId = props?.id != null ? String(props.id) : "";
  if (!onboardingId) return;

  const version = typeof props?.version === "number" ? props.version : Number(props?.version) || 1;
  const step =
    props?.step != null && String(props.step).trim()
      ? String(props.step)
      : null;

  void apiClient
    .requestSafe("/api/alunos/me/onboarding-events", {
      method: "POST",
      body: JSON.stringify({
        onboarding_id: onboardingId,
        event_name: EVENT_TO_SERVER[name],
        version,
        step_id: step,
      }),
    })
    .catch(() => {
      /* telemetria best-effort */
    });
}
