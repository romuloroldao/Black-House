/**
 * Instrumentação mínima do portal do aluno (Onda 0.1).
 * Hoje: CustomEvent + log em dev. Trocar o sink quando houver provedor (PostHog/GA).
 */

export type StudentAnalyticsEvent =
  | "student_tab_view"
  | "checkin_started"
  | "checkin_submitted"
  | "checkin_abandoned"
  | "workout_opened"
  | "workout_pdf_exported"
  | "diet_sub_applied"
  | "diet_sub_persisted"
  | "hoje_cta_clicked";

type EventProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    __studentAnalytics?: Array<{ name: string; props: EventProps; ts: number }>;
  }
}

export function trackStudentEvent(
  name: StudentAnalyticsEvent,
  props: EventProps = {}
) {
  const payload = {
    name,
    props: {
      ...props,
      device_width:
        typeof window !== "undefined" ? window.innerWidth : undefined,
    },
    ts: Date.now(),
  };

  if (typeof window !== "undefined") {
    window.__studentAnalytics = window.__studentAnalytics || [];
    window.__studentAnalytics.push(payload);
    window.dispatchEvent(
      new CustomEvent("student-analytics", { detail: payload })
    );
  }

  if (import.meta.env.DEV) {
    console.debug("[student-analytics]", payload);
  }
}
