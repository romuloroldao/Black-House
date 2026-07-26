/**
 * Context builder — allowlist determinística para o agente do aluno.
 */

const { getAlunoHoje } = require('../aluno-hoje.service');
const { getProximaAcao } = require('../proxima-acao.service');
const { normalizeAcesso } = require('../../utils/aluno-platform-access');

function pickAluno(aluno) {
  if (!aluno) return null;
  return {
    id: aluno.id,
    nome: aluno.nome || null,
    objetivo: aluno.objetivo || null,
  };
}

function pickHoje(hoje) {
  if (!hoje) return null;
  return {
    dieta: hoje.dieta
      ? {
          id: hoje.dieta.id,
          nome: hoje.dieta.nome || null,
          ativa: hoje.dieta.ativa,
        }
      : null,
    dieta_rotacao: hoje.dieta_rotacao
      ? { plano: hoje.dieta_rotacao.plano, today_label: hoje.dieta_rotacao.today_label }
      : null,
    treino: hoje.treino
      ? {
          nome: hoje.treino.detalhe?.nome || null,
          treino_id: hoje.treino.detalhe?.id || null,
          aluno_treino_id: hoje.treino.vinculo?.id || null,
          descanso_hoje: Boolean(hoje.treino.descanso_hoje),
          from_agenda: Boolean(hoje.treino.from_agenda),
        }
      : null,
    pendencias: (hoje.pendencias || []).map((p) => ({
      id: p.id,
      title: p.title,
      tab: p.tab,
      priority: p.priority,
    })),
    contadores: hoje.contadores || null,
    execucao: hoje.execucao || null,
    behavioral_insight: hoje.behavioral_insight
      ? {
          tone: hoje.behavioral_insight.tone,
          text: hoje.behavioral_insight.text,
          streak_days: hoje.behavioral_insight.streak_days,
          miss_days_recent: hoje.behavioral_insight.miss_days_recent,
        }
      : null,
    gerado_em: hoje.gerado_em,
  };
}

async function buildStudentAgentContext(pool, { aluno, userId, paymentStatus, mealKeys }) {
  const acessoOp = normalizeAcesso(aluno?.acesso_operacional);
  const accessBlocked =
    acessoOp === 'access_suspended' ||
    acessoOp === 'access_revoked' ||
    acessoOp === 'access_pending' ||
    acessoOp === 'not_linked' ||
    paymentStatus === 'OVERDUE' ||
    paymentStatus === 'PENDING_AFTER_DUE_DATE';

  const hojeFull = await getAlunoHoje(pool, { aluno, userId });
  const proxima = await getProximaAcao(pool, {
    aluno,
    userId,
    mealKeys: mealKeys || null,
  });

  const treinoActual = hojeFull.treino
    ? {
        nome: hojeFull.treino.detalhe?.nome || null,
        descanso_hoje: Boolean(hojeFull.treino.descanso_hoje),
        treino_id: hojeFull.treino.detalhe?.id || null,
        aluno_treino_id: hojeFull.treino.vinculo?.id || null,
      }
    : null;

  const coachRulesService = require('../coach-rules.service');
  // Seed opcional a partir da observação de refeição livre da dieta
  if (aluno?.coach_id && hojeFull.dieta) {
    await coachRulesService.maybeSeedFromDieta(pool, aluno.coach_id, hojeFull.dieta);
  }
  const coach_rules = await coachRulesService.listActiveForAgent(pool, aluno?.coach_id, {
    limit: 20,
  });

  const freeMealHint =
    hojeFull.dieta?.refeicao_livre_observacao
      ? String(hojeFull.dieta.refeicao_livre_observacao).trim().slice(0, 500)
      : null;

  return {
    aluno: pickAluno(aluno),
    acesso: {
      operacional: acessoOp,
      payment_status: paymentStatus || null,
      blocked: accessBlocked,
    },
    hoje: pickHoje(hojeFull),
    execucao: hojeFull.execucao || { refeicoes_concluidas: [], treino_sessao: null },
    proxima_acao: proxima,
    treino_actual: treinoActual,
    refeicao_actual:
      proxima?.type === 'next_meal'
        ? {
            meal_key: proxima.payload?.meal_key || null,
            plano: proxima.payload?.plano || null,
            dieta_id: proxima.payload?.dieta_id || null,
          }
        : null,
    behavioral_insight: hojeFull.behavioral_insight || null,
    coach_rules,
    free_meal_hint: freeMealHint,
  };
}

module.exports = {
  buildStudentAgentContext,
  pickAluno,
  pickHoje,
};
