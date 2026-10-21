import { getAlunoFirstName } from "@/lib/aluno-display";
import type { AlunoHojeResponse } from "@/types/aluno-hoje";
import type { ProximaAcao } from "@/components/student/agent/NextActionHero";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";

export function getTimeGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const COLEMAN_MET_KEY = "bh-coleman-met";

export function hasMetColeman(): boolean {
  return safeGetItem(COLEMAN_MET_KEY) === "1";
}

export function markColemanMet(): void {
  safeSetItem(COLEMAN_MET_KEY, "1");
}

function mealTimeHint(proxima: ProximaAcao | null): string | null {
  if (!proxima) return null;
  if (proxima.type !== "next_meal" && proxima.type !== "open_diet") return null;
  const raw = proxima.description || proxima.title || "";
  const time = raw.match(/\b(\d{1,2})[:hH](\d{2})?\b/);
  if (time) {
    const hh = time[1].padStart(2, "0");
    const mm = time[2] || "00";
    return `${hh}:${mm}`;
  }
  return raw.trim() || null;
}

function dayPhase(now = new Date()): "morning" | "lunch" | "afternoon" | "evening" {
  const h = now.getHours();
  if (h < 10) return "morning";
  if (h < 14) return "lunch";
  if (h < 18) return "afternoon";
  return "evening";
}

/**
 * Briefing do Coleman (1×/dia) — narrativo, contextual, sem checklist.
 */
export function composeHomeOpening(
  data: AlunoHojeResponse | null,
  proxima: ProximaAcao | null,
  now = new Date(),
): string {
  const firstName = getAlunoFirstName(
    data?.aluno as { nome?: string; email?: string } | null,
    "atleta",
  );
  const firstTime = !hasMetColeman();
  const phase = dayPhase(now);
  const mealHint = mealTimeHint(proxima);
  const parts: string[] = [];

  if (firstTime) {
    parts.push(
      `${getTimeGreeting(now)}, ${firstName}! Sou o Coleman — seu especialista em nutrição e performance na Black House.`,
    );
    parts.push(
      "Estou aqui para entender seu plano, recomendar ajustes e executar o que fizer sentido — tudo na conversa.",
    );
  } else {
    parts.push(`${getTimeGreeting(now)}, ${firstName}!`);
  }

  // Âncora dinâmica por horário / estado
  if (data?.treino?.descanso_hoje) {
    parts.push("Hoje é descanso. O foco é dieta e recuperação.");
  } else if (data?.execucao?.treino_sessao?.status === "completed") {
    parts.push(
      data?.treino?.detalhe?.nome
        ? `Treino «${data.treino.detalhe.nome}» concluído. Quer revisar a próxima refeição?`
        : "Treino concluído. Quer revisar a próxima refeição?",
    );
  } else if (data?.treino?.detalhe?.nome && phase !== "evening") {
    parts.push(`Hoje tem treino: «${data.treino.detalhe.nome}».`);
  }

  if (proxima?.type === "next_meal" || proxima?.type === "open_diet") {
    if (phase === "morning" && mealHint) {
      parts.push(
        /^\d{2}:\d{2}$/.test(mealHint)
          ? `Seu café / próxima refeição está a caminho — por volta das ${mealHint}.`
          : `Sua próxima refeição: ${mealHint}.`,
      );
    } else if (phase === "lunch") {
      parts.push(
        mealHint
          ? `Seu almoço está no plano${/^\d{2}:\d{2}$/.test(mealHint) ? ` (por volta das ${mealHint})` : `: ${mealHint}`}.`
          : "Seu almoço está planejado — posso detalhar ou ajustar.",
      );
    } else if (phase === "evening") {
      parts.push(
        mealHint
          ? `Ainda tem ${mealHint} no radar. Posso ajudar a fechar o dia bem.`
          : "Você já avançou bem no plano de hoje — posso ajudar a fechar o que falta.",
      );
    } else if (mealHint) {
      parts.push(
        /^\d{2}:\d{2}$/.test(mealHint)
          ? `Próxima refeição por volta das ${mealHint}.`
          : `Próxima refeição: ${mealHint}.`,
      );
    }
  }

  const fotoPendente =
    data?.contadores?.checkin_due ||
    (data?.fotos_evolucao && !data.fotos_evolucao.enviou_esta_semana);
  if (fotoPendente) {
    parts.push("Ainda falta a foto semanal.");
  }

  const weeks = data?.checkin_streak?.semanas_consecutivas;
  if (weeks != null && weeks >= 2) {
    parts.push(`${weeks} semanas de ritmo — continue assim.`);
  }

  parts.push(
    firstTime
      ? "Pode me pedir a próxima refeição, uma troca de alimento ou o que fazer agora."
      : "Como posso te ajudar agora?",
  );

  return parts.join(" ");
}

/** v4: opening Coleman */
export function openingStorageKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `bh-agent-opening-v4-${y}-${m}-${d}`;
}
