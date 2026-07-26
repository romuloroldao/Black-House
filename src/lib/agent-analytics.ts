/** Telemetria leve do Agent Home (console + CustomEvent; sem vendor). */

export type AgentAnalyticsEvent =
  | "agent_home_view"
  | "agent_intent_sent"
  | "agent_card_action"
  | "nav_traditional_open"
  | "agent_return"
  | "agent_hydrate"
  | "agent_error";

export function trackAgentEvent(
  name: AgentAnalyticsEvent,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  const detail = { name, props: props || {}, at: new Date().toISOString() };
  try {
    window.dispatchEvent(new CustomEvent("blackhouse:agent-analytics", { detail }));
  } catch {
    /* ignore */
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[agent-analytics]", detail);
  }
}
