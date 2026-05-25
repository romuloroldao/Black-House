/** Semanas consecutivas com check-in (segunda-feira como início da semana). */

export function startOfCalendarWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekKeyFromDate(date: Date | string): string {
  return startOfCalendarWeek(new Date(date)).toISOString().slice(0, 10);
}

export type CheckinStreakInfo = {
  semanas_consecutivas: number;
  fez_esta_semana: boolean;
  total_checkins: number;
  badge: string | null;
};

export function computeCheckinStreak(
  checkins: Array<{ created_at?: string | null }>,
): CheckinStreakInfo {
  const weeks = new Set<string>();
  for (const c of checkins) {
    if (c.created_at) weeks.add(weekKeyFromDate(c.created_at));
  }

  const estaSemana = weekKeyFromDate(new Date());
  let streak = 0;
  let cursor = new Date(estaSemana + "T12:00:00");

  while (weeks.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  let badge: string | null = null;
  if (streak >= 8) badge = "8+ semanas firme";
  else if (streak >= 4) badge = "4 check-ins seguidos";
  else if (streak >= 2) badge = "Em sequência";

  return {
    semanas_consecutivas: streak,
    fez_esta_semana: weeks.has(estaSemana),
    total_checkins: checkins.length,
    badge,
  };
}
