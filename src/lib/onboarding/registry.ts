import type { FeatureOnboardingDefinition } from "./types";

/**
 * Catálogo estável de onboardings contextuais.
 * IDs não devem mudar; bump de `version` só com alteração substancial de fluxo.
 */
export const FEATURE_ONBOARDINGS: Record<string, FeatureOnboardingDefinition> = {
  "portal-overview": {
    id: "portal-overview",
    version: 1,
    title: "Bem-vindo à Black House",
    steps: [
      {
        id: "hoje",
        title: "O seu dia num só lugar",
        body: "No ecrã Hoje vê treino, dieta, pendências e o Coleman. É a página inicial ao entrar.",
      },
      {
        id: "dieta-treino",
        title: "Dieta e treino no telemóvel",
        body: "Marque refeições, alterne Plano A/B e inicie a sessão de treino com timer de descanso.",
      },
      {
        id: "checkin",
        title: "Check-in e coach",
        body: "O check-in semanal (fotos + peso) e o chat com o coach ficam a um toque no menu.",
      },
    ],
  },
  "checkin-weekly": {
    id: "checkin-weekly",
    version: 1,
    title: "Check-in semanal",
    steps: [
      {
        id: "photos",
        title: "Fotos e peso",
        body: "Comece pelas fotos de frente e costas e informe o peso. Sem isso o envio não fecha.",
        target: '[data-onboarding="checkin-photos"]',
      },
      {
        id: "blocks",
        title: "Responda por blocos",
        body: "Use «Próximo bloco» para avançar. As respostas ficam guardadas se sair e voltar.",
        target: '[data-onboarding="checkin-steps"]',
      },
      {
        id: "submit",
        title: "Enviar com calma",
        body: "No fim, toque em Enviar. O botão mostra o progresso (foto 1 de 2…). Wi‑Fi ajuda em fotos grandes.",
        target: '[data-onboarding="checkin-submit"]',
      },
    ],
  },
  "hoje-coleman": {
    id: "hoje-coleman",
    version: 1,
    title: "Hoje com o Coleman",
    steps: [
      {
        id: "composer",
        title: "Pergunte ao Coleman",
        body: "Escreva ou toque numa sugestão para tirar dúvidas do dia (treino, dieta, próximos passos).",
        target: '[data-onboarding="hoje-composer"]',
      },
      {
        id: "mais",
        title: "Mais do dia",
        body: "Abra «Mais do dia» para ver pendências e atalhos sem sair do Hoje.",
        target: '[data-onboarding="hoje-mais"]',
      },
    ],
  },
  "treino-sessao": {
    id: "treino-sessao",
    version: 1,
    title: "Sessão de treino",
    steps: [
      {
        id: "start",
        title: "Inicie a sessão",
        body: "Toque em iniciar no treino do dia. A sessão guarda séries, cargas e descanso no servidor.",
        target: '[data-onboarding="treino-start"]',
      },
      {
        id: "series",
        title: "Registe série a série",
        body: "Em cada exercício, confirme carga e repetições. Pode pausar e voltar depois.",
        target: '[data-onboarding="treino-session"]',
      },
    ],
  },
  "dieta-refeicao": {
    id: "dieta-refeicao",
    version: 1,
    title: "Dieta do dia",
    steps: [
      {
        id: "plano",
        title: "Plano A ou B",
        body: "Se o coach configurou rotação, alterne o plano aqui antes de marcar as refeições.",
        target: '[data-onboarding="dieta-plano"]',
      },
      {
        id: "concluir",
        title: "Marcar refeição",
        body: "Toque na refeição para marcar como feita. O Hoje e o coach passam a ver a sua aderência.",
        target: '[data-onboarding="dieta-refeicoes"]',
      },
    ],
  },
};

export function getOnboardingDefinition(id: string): FeatureOnboardingDefinition | null {
  return FEATURE_ONBOARDINGS[id] ?? null;
}
