/** Feature flag Daily Agent (portal aluno). Default: ligado. */
export function isAgentDailyEnabled(): boolean {
  const raw = import.meta.env.VITE_AGENT_DAILY_ENABLED;
  if (raw === undefined || raw === null || raw === "") return true;
  const v = String(raw).trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}
