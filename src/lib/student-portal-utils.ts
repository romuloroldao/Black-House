import type { AlunoHojePendencia, AlunoHojeRetorno } from "@/types/aluno-hoje";

/** Utilitários partilhados pelo portal do aluno (dashboard, futuro ecrã Hoje). */

export type PendingTask = {
  id: string;
  title: string;
  description: string;
  tab: string;
  priority: "high" | "normal";
  /** Parâmetros extra na URL do portal (ex.: coachView=chat). */
  searchParams?: Record<string, string>;
};

export type ReturnCountdownInfo = {
  date: string;
  days: number;
  label: string;
  source: "dieta" | "treino";
  planName?: string | null;
  overdue: boolean;
};

export function parseDateOnly(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfCalendarWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function diffCalendarDays(target: Date, from = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatReturnCountdownLabel(days: number): string {
  if (days > 1) return `Retorno em ${days} dias`;
  if (days === 1) return "Retorno amanhã";
  if (days === 0) return "Retorno é hoje";
  const overdue = Math.abs(days);
  if (overdue === 1) return "Retorno há 1 dia";
  return `Retorno há ${overdue} dias`;
}

export function pickReturnCountdown(
  dieta: { data_retorno?: string | null; nome?: string | null } | null,
  alunoTreino: { data_retorno?: string | null } | null,
  treinoNome?: string | null,
): ReturnCountdownInfo | null {
  const candidates: Array<{
    date: Date;
    iso: string;
    source: "dieta" | "treino";
    planName?: string | null;
  }> = [];

  const dietaDate = parseDateOnly(dieta?.data_retorno);
  if (dietaDate) {
    candidates.push({
      date: dietaDate,
      iso: String(dieta?.data_retorno).slice(0, 10),
      source: "dieta",
      planName: dieta?.nome ?? null,
    });
  }

  const treinoDate = parseDateOnly(alunoTreino?.data_retorno);
  if (treinoDate) {
    candidates.push({
      date: treinoDate,
      iso: String(alunoTreino?.data_retorno).slice(0, 10),
      source: "treino",
      planName: treinoNome ?? null,
    });
  }

  if (candidates.length === 0) return null;

  const today = new Date();
  const future = candidates
    .map((c) => ({ ...c, days: diffCalendarDays(c.date, today) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);

  const pick =
    future[0] ??
    candidates
      .map((c) => ({ ...c, days: diffCalendarDays(c.date, today) }))
      .sort((a, b) => b.days - a.days)[0];

  const days = pick.days;
  return {
    date: pick.iso,
    days,
    label: formatReturnCountdownLabel(days),
    source: pick.source,
    planName: pick.planName,
    overdue: days < 0,
  };
}

export function hasCheckinThisWeek(
  checkins: Array<{ created_at?: string | null }>,
): boolean {
  const weekStart = startOfCalendarWeek();
  return checkins.some((c) => {
    if (!c.created_at) return false;
    const created = new Date(c.created_at);
    return !Number.isNaN(created.getTime()) && created >= weekStart;
  });
}

export function buildPendingTasks(input: {
  checkinDue: boolean;
  unreadChat: number;
  unreadAnnouncements: number;
}): PendingTask[] {
  const tasks: PendingTask[] = [];

  if (input.checkinDue) {
    tasks.push({
      id: "checkin-weekly",
      title: "Check-in semanal",
      description:
        "Ainda não enviou esta semana — abra e conclua o check-in (peso, fotos e questionário).",
      tab: "checkin",
      priority: "high",
    });
  }

  if (input.unreadChat > 0) {
    tasks.push({
      id: "chat-unread",
      title:
        input.unreadChat === 1
          ? "1 mensagem nova no chat"
          : `${input.unreadChat} mensagens novas no chat`,
      description: "Seu coach enviou uma mensagem. Responda quando puder.",
      tab: "coach",
      searchParams: { coachView: "chat" },
      priority: "high",
    });
  }

  if (input.unreadAnnouncements > 0) {
    tasks.push({
      id: "announcements-unread",
      title:
        input.unreadAnnouncements === 1
          ? "1 aviso do coach"
          : `${input.unreadAnnouncements} avisos do coach`,
      description: "Leia os avisos do coach na aba Coach.",
      tab: "coach",
      searchParams: { coachView: "avisos" },
      priority: "normal",
    });
  }

  return tasks;
}

export function mapRetornoFromApi(retorno: AlunoHojeRetorno | null | undefined): ReturnCountdownInfo | null {
  if (!retorno) return null;
  return {
    date: retorno.date,
    days: retorno.days,
    label: retorno.label,
    source: retorno.source,
    planName: retorno.plan_name ?? null,
    overdue: retorno.overdue,
  };
}

export function mapPendenciasFromApi(items: AlunoHojePendencia[] | undefined): PendingTask[] {
  if (!items?.length) return [];
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    tab: item.tab,
    priority: item.priority,
    searchParams: item.search_params,
  }));
}
