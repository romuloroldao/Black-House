/** Utilitários para fotos de evolução do aluno (semana calendário = segunda a domingo). */

export function startOfCalendarWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function hasPhotoThisCalendarWeek(lastPhotoIso: string | null | undefined): boolean {
  if (!lastPhotoIso) return false;
  const created = new Date(String(lastPhotoIso));
  if (Number.isNaN(created.getTime())) return false;
  return created >= startOfCalendarWeek();
}

export function formatPhotoAgeLabel(lastPhotoIso: string | null | undefined): string {
  if (!lastPhotoIso) return "Ainda não enviou";
  const created = new Date(String(lastPhotoIso));
  if (Number.isNaN(created.getTime())) return "";
  const today = new Date();
  const diffDays = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()) /
      86400000,
  );
  if (diffDays <= 0) return "Enviada hoje";
  if (diffDays === 1) return "Enviada ontem";
  if (diffDays < 7) return `Enviada há ${diffDays} dias`;
  return created.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
