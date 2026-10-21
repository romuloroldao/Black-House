/** Categorias de notificação no portal do aluno (Fase 3.4 / 4). */

export type StudentNotificationCategory = "coach" | "sistema" | "retorno";

const COACH_TYPES = new Set([
  "mensagem",
  "aviso",
  "aluno",
  "checkin_reminder",
  "checkin_respondido",
  "checkin_missed",
  "task_reminder",
  "dieta_atualizada",
]);

const RETORNO_TYPES = new Set([
  "workout_expiration_reminder",
  "treino",
  "agenda",
  "agenda_coach_reminder",
  "agenda_coach_overdue",
  "event_reminder",
  "novo_evento",
  "evento_cancelado",
]);

export function getStudentNotificationCategory(tipo: string): StudentNotificationCategory {
  const t = (tipo || "").toLowerCase();
  if (COACH_TYPES.has(t)) return "coach";
  if (RETORNO_TYPES.has(t)) return "retorno";
  return "sistema";
}

export const STUDENT_NOTIFICATION_CATEGORY_LABELS: Record<StudentNotificationCategory, string> = {
  coach: "Coach",
  sistema: "Sistema",
  retorno: "Retorno",
};
