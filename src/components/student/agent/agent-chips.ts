export type AgentChip = { label: string; text: string };

/** Atalhos base do Agent Home */
export const AGENT_BASE_CHIPS: AgentChip[] = [
  { label: "O que faço agora?", text: "O que faço agora?" },
  { label: "Próxima refeição", text: "Qual minha próxima refeição?" },
  { label: "Treino", text: "Qual meu treino de hoje?" },
  { label: "Iniciar treino", text: "Iniciar treino" },
  { label: "Concluí", text: "Concluí." },
  { label: "Atrasado", text: "Estou atrasado." },
  { label: "Restaurante", text: "Estou num restaurante." },
  { label: "Substituir", text: "Quero substituir um alimento." },
  { label: "Peso", text: "Quero registar o peso." },
  { label: "Como estou?", text: "Como estou esta semana?" },
  { label: "Evolução", text: "Quero ver minha evolução." },
];

export type ProximaAcaoLike = {
  type?: string | null;
} | null;

/** Prioriza chips conforme a próxima acção do dia */
export function chipsForProximaAcao(acao: ProximaAcaoLike): AgentChip[] {
  const type = acao?.type || "";
  const prioritized: AgentChip[] = [];

  if (type === "next_meal" || type === "open_diet") {
    prioritized.push(
      { label: "Próxima refeição", text: "Qual minha próxima refeição?" },
      { label: "Concluí", text: "Concluí." },
      { label: "Restaurante", text: "Estou num restaurante." },
    );
  } else if (type === "today_workout") {
    prioritized.push(
      { label: "Treino", text: "Qual meu treino de hoje?" },
      { label: "Iniciar treino", text: "Iniciar treino" },
      { label: "Concluí", text: "Concluí." },
    );
  } else if (type === "checkin") {
    prioritized.push(
      { label: "Check-in", text: "Preciso fazer o check-in." },
      { label: "Peso", text: "Quero registar o peso." },
    );
  } else {
    prioritized.push({ label: "O que faço agora?", text: "O que faço agora?" });
  }

  const seen = new Set(prioritized.map((c) => c.label));
  for (const chip of AGENT_BASE_CHIPS) {
    if (!seen.has(chip.label)) {
      prioritized.push(chip);
      seen.add(chip.label);
    }
  }
  return prioritized;
}
