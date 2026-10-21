import type { AlunoHojeResponse } from "@/types/aluno-hoje";

export type AgentChip = { label: string; text: string };

/** Sugestões secundárias do Coleman (textos alinhados ao fast-path). */
export const COLEMAN_CORE_CHIPS: AgentChip[] = [
  { label: "Próxima refeição", text: "Qual minha próxima refeição?" },
  { label: "Trocar alimento", text: "Quero substituir um alimento." },
  { label: "Analisar refeição", text: "Quero analisar uma refeição." },
  { label: "O que faço agora?", text: "O que faço agora?" },
];

/** Compat: mock antigo */
export const AGENT_MOCK_CHIPS: AgentChip[] = [
  { label: "Minha dieta", text: "Como está minha dieta hoje?" },
  { label: "Meu treino", text: "Qual meu treino de hoje?" },
  { label: "Trocar alimento", text: "Quero substituir um alimento." },
  { label: "Enviar foto", text: "Preciso enviar minha foto semanal." },
  { label: "Registrar peso", text: "Quero registrar o peso." },
];

export const AGENT_BASE_CHIPS: AgentChip[] = [
  ...COLEMAN_CORE_CHIPS,
  ...AGENT_MOCK_CHIPS,
  { label: "Iniciar treino", text: "Iniciar treino" },
  { label: "Falar com coach", text: "Quero falar com o coach." },
  { label: "Concluí", text: "Concluí." },
  { label: "Atrasado", text: "Estou atrasado." },
  { label: "Restaurante", text: "Estou num restaurante." },
  { label: "Como estou?", text: "Como estou esta semana?" },
  { label: "Evolução", text: "Quero ver minha evolução." },
  { label: "Recuperação", text: "É dia de descanso. O que faço para recuperar bem?" },
  { label: "Próximo treino", text: "Qual é o meu próximo treino?" },
  { label: "Registrar peso", text: "Quero registrar o peso." },
  { label: "Enviar foto", text: "Preciso enviar minha foto semanal." },
];

export type ProximaAcaoLike = {
  type?: string | null;
} | null;

const MAX = 4;

function pushUnique(out: AgentChip[], chip: AgentChip, seen: Set<string>) {
  if (seen.has(chip.label)) return;
  out.push(chip);
  seen.add(chip.label);
}

/**
 * Sugestões leves e contextuais — secundárias à conversa.
 * Mantém `text` compatível com classifyFastPath.
 */
export function chipsForHojeContext({
  proxima,
  hoje,
}: {
  proxima?: ProximaAcaoLike;
  hoje?: AlunoHojeResponse | null;
} = {}): AgentChip[] {
  const type = proxima?.type || "";
  const out: AgentChip[] = [];
  const seen = new Set<string>();

  if (type === "next_meal" || type === "open_diet") {
    pushUnique(out, { label: "Próxima refeição", text: "Qual minha próxima refeição?" }, seen);
    pushUnique(out, { label: "Trocar alimento", text: "Quero substituir um alimento." }, seen);
    pushUnique(out, { label: "Analisar refeição", text: "Quero analisar uma refeição." }, seen);
  } else if (type === "today_workout") {
    pushUnique(out, { label: "Meu treino", text: "Qual meu treino de hoje?" }, seen);
    pushUnique(out, { label: "Iniciar treino", text: "Iniciar treino" }, seen);
    pushUnique(out, { label: "Próxima refeição", text: "Qual minha próxima refeição?" }, seen);
  } else if (type === "checkin") {
    pushUnique(out, { label: "Enviar foto", text: "Preciso enviar minha foto semanal." }, seen);
    pushUnique(out, { label: "Registrar peso", text: "Quero registrar o peso." }, seen);
  }

  if (hoje?.treino?.descanso_hoje) {
    pushUnique(
      out,
      { label: "Recuperação", text: "É dia de descanso. O que faço para recuperar bem?" },
      seen,
    );
  }

  if (hoje?.contadores?.checkin_due || (hoje?.fotos_evolucao && !hoje.fotos_evolucao.enviou_esta_semana)) {
    pushUnique(out, { label: "Enviar foto", text: "Preciso enviar minha foto semanal." }, seen);
  }

  for (const chip of COLEMAN_CORE_CHIPS) {
    if (out.length >= MAX) break;
    pushUnique(out, chip, seen);
  }

  return out.slice(0, MAX);
}

export function chipsForProximaAcao(acao: ProximaAcaoLike): AgentChip[] {
  return chipsForHojeContext({ proxima: acao, hoje: null });
}
