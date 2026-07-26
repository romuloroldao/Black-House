/**
 * Orchestrator do agente aluno — fast path + LLM structured opcional.
 */

const agentRepo = require('../../repositories/agent.repository');
const { buildStudentAgentContext } = require('./context-builder');
const { dispatchTool, listToolsForPrompt } = require('./tool-registry');
const { SYSTEM_PROMPT_V1 } = require('./prompts');
const { estimateTokensFromText, estimateCostUsd } = require('./cost');
const { parseRelativeDay } = require('./temporal');
const composer = require('./response-composer');

const TOOL_LOOP_CAP = 5;

function classifyFastPath(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();

  if (!t) return null;

  if (
    /alter(a|ar)|muda(r)?\s+(minha\s+)?(dieta|treino|plano)|suspende|cancela\s+pagamento|baixa\s+calor/.test(
      t,
    )
  ) {
    return { intent: 'refuse', mode: 'refuse_high_impact' };
  }
  if (/restaurante|cardapio|fora\s+do\s+plano|comer\s+fora/.test(t)) {
    return { intent: 'restaurant', mode: 'restaurant' };
  }
  if (/substit(u|o)|trocar\s+(o\s+)?alimento|equivalen/.test(t)) {
    return { intent: 'substitution', mode: 'substitution' };
  }

  const weightMatch = t.match(
    /(?:regist(?:ar|rar|r)?\s+)?peso\s*(?:de\s*|atual\s*|em\s*)?(\d+(?:[.,]\d+)?)\s*kg?|(?:peso|pesar)\s+(\d+(?:[.,]\d+)?)/,
  );
  if (weightMatch) {
    const raw = weightMatch[1] || weightMatch[2];
    const peso = Number(String(raw).replace(',', '.'));
    if (Number.isFinite(peso) && peso > 20 && peso < 400) {
      return { intent: 'log_weight', mode: 'log_weight', peso_kg: peso };
    }
  }
  if (/peso|pesar|balanca/.test(t)) {
    return { intent: 'ask_weight', mode: 'ask_weight' };
  }

  if (/evoluc|fotos?\s+de\s+evoluc|ver\s+(minha\s+)?evoluc|comparar\s+fotos/.test(t)) {
    return { intent: 'progress', mode: 'open_progress' };
  }
  if (/relatorio|relatórios|relatorios/.test(t)) {
    return { intent: 'reports', mode: 'open_reports' };
  }
  if (/video|vídeo|conteudo|conteúdo|aula/.test(t)) {
    return { intent: 'videos', mode: 'open_videos' };
  }
  if (/check[\s-]?in|checkin/.test(t)) {
    return { intent: 'checkin', mode: 'open_checkin' };
  }

  if (/como\s+estou|aderenc|streak|progresso|ritmo|falt(ei|ou)|miss/.test(t)) {
    return { intent: 'behavioral', mode: 'behavioral' };
  }
  if (/conclui|concluir|feito|done|marquei|terminei\s+a\s+refeicao/.test(t)) {
    return { intent: 'complete', mode: 'complete' };
  }
  if (/atrasad|tarde|nao\s+deu\s+tempo/.test(t)) {
    return { intent: 'late', mode: 'late' };
  }
  if (/voltei|estou\s+de\s+volta/.test(t)) {
    return { intent: 'resume', mode: 'resume' };
  }
  if (/sessao\s+guiada|comecar\s+treino|iniciar\s+treino|comecar\s+a\s+treinar/.test(t)) {
    const day = parseRelativeDay(t);
    return { intent: 'start_workout', mode: 'start_workout', day };
  }
  // "próximo treino" / "quando treino" → olhar agenda à frente (não só hoje)
  if (
    /proxim[oa].{0,20}treino|treino.{0,12}proxim|quando\s+(e\s+que\s+)?(eu\s+)?trein|qual\s+(e\s+)?(o\s+)?meu\s+proxim/.test(
      t,
    )
  ) {
    return { intent: 'next_workout', mode: 'next_workout' };
  }
  if (/treino|treinar|exercicio/.test(t)) {
    const day = parseRelativeDay(t);
    return { intent: 'workout_day', mode: 'workout_day', day };
  }
  if (/refeicao|comer|almoco|jantar|cafe|o\s+que\s+(eu\s+)?como/.test(t)) {
    return { intent: 'next_meal', mode: 'next_meal' };
  }
  if (/o\s+que\s+(faco|fazer)|proxima\s+acao|agora\??$|hoje\??$/.test(t)) {
    return { intent: 'next_action', mode: 'next_action' };
  }
  return null;
}

function cardFromAction(acao) {
  return composer.cardFromProximaAcao(acao);
}

async function runFastPath(ctx, mode, context, options = {}) {
  const toolResults = [];
  let assistantText = '';
  let cards = [];
  let intent = mode;
  const day = options.day || parseRelativeDay('');

  if (mode === 'refuse_high_impact') {
    await agentRepo.insertDecision(ctx.pool, {
      run_id: ctx.runId,
      kind: 'refuse_high_impact',
      reason: 'Pedido de alteração de plano/financeiro',
      payload: {},
    });
    assistantText =
      'Não posso alterar o teu plano. Isso só o coach faz. Queres que prepare um rascunho de mensagem para ele?';
    cards = [
      {
        id: 'talk-coach',
        title: 'Falar com o coach',
        body: 'Abre o chat para pedir um ajuste.',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'coach_chat' } },
        secondary_action: null,
      },
    ];
    return { intent: 'refuse', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'restaurant') {
    const rules = (context.coach_rules || []).filter(
      (r) => r.trigger === 'restaurant' || r.trigger === 'always',
    );
    const { formatRulesHint } = require('../coach-rules.service');
    const hint =
      formatRulesHint(
        rules.filter((r) => r.trigger === 'restaurant'),
        { max: 2 },
      ) || null;
    const composed = composer.composeRestaurant({
      freeMealHint: context.free_meal_hint,
      coachHint: hint,
    });
    assistantText = composed.assistantText;
    cards = composed.cards;
    const open = await dispatchTool(ctx, {
      name: 'open_ui',
      args: { target: 'meal_photo' },
    });
    toolResults.push({ name: 'open_ui', result: open });
    return { intent: 'restaurant', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'substitution') {
    const rules = (context.coach_rules || []).filter(
      (r) => r.trigger === 'substitution' || r.trigger === 'always',
    );
    const { formatRulesHint } = require('../coach-rules.service');
    const hint = formatRulesHint(
      rules.filter((r) => r.trigger === 'substitution'),
      { max: 2 },
    );
    assistantText =
      'Para trocar um alimento, abre a refeição na dieta e usa «Substitutos». A troca vale só para hoje e mantém as kcal.';
    if (hint) {
      assistantText += `\n\nOrientação do teu coach:\n${hint}`;
    }
    cards = [
      {
        id: 'open-diet-sub',
        title: 'Abrir dieta',
        body: 'Escolhe o item e vê opções isocalóricas',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'dieta' } },
        secondary_action: null,
      },
    ];
    const open = await dispatchTool(ctx, {
      name: 'open_ui',
      args: { target: 'dieta' },
    });
    toolResults.push({ name: 'open_ui', result: open });
    return { intent: 'substitution', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'behavioral') {
    const result = await dispatchTool(ctx, {
      name: 'get_behavioral_insight',
      args: { days: 7 },
    });
    toolResults.push({ name: 'get_behavioral_insight', result });
    const insight = result?.data;
    const next = await dispatchTool(ctx, { name: 'get_next_action', args: {} });
    toolResults.push({ name: 'get_next_action', result: next });
    const composed = composer.composeBehavioral({
      insightText: insight?.text,
      proximaAcao: next?.data,
      checkinDue: Boolean(next?.data?.type === 'checkin' || context.proxima_acao?.payload?.checkin_due),
    });
    return {
      intent: 'behavioral',
      assistantText: composed.assistantText,
      cards: composed.cards,
      toolResults,
      usedLlm: false,
    };
  }

  if (mode === 'ask_weight') {
    assistantText = 'Qual o teu peso atual em kg? Podes escrever «peso 78.5» ou usar o botão.';
    cards = [
      {
        id: 'ask-weight',
        title: 'Registar peso',
        body: 'Indica o valor em quilogramas',
        primary_action: { type: 'tool', name: 'ask_weight', args: {} },
        secondary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'checkin' } },
      },
    ];
    return { intent: 'ask_weight', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'log_weight') {
    const pesoKg = Number(options.peso_kg);
    if (!Number.isFinite(pesoKg) || pesoKg <= 20 || pesoKg >= 400) {
      return runFastPath(ctx, 'ask_weight', context, options);
    }
    const result = await dispatchTool(ctx, {
      name: 'log_body_weight',
      args: { peso_kg: pesoKg },
    });
    toolResults.push({ name: 'log_body_weight', result });
    assistantText = result?.ok
      ? `Peso registado: ${pesoKg} kg.`
      : `Não consegui registar o peso${result?.error ? `: ${result.error}` : '.'}`;
    const next = await dispatchTool(ctx, { name: 'get_next_action', args: {} });
    toolResults.push({ name: 'get_next_action', result: next });
    cards = next?.data ? [cardFromAction(next.data)].filter(Boolean) : [];
    return { intent: 'log_weight', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'open_progress') {
    assistantText = 'Aqui podes ver fotos e métricas da tua evolução.';
    cards = [
      {
        id: 'open-progress',
        title: 'Evolução',
        body: 'Fotos e métricas',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'progress' } },
        secondary_action: {
          type: 'open_ui',
          name: 'open_ui',
          args: { target: 'progress_photos' },
        },
      },
    ];
    const open = await dispatchTool(ctx, {
      name: 'open_ui',
      args: { target: 'progress' },
    });
    toolResults.push({ name: 'open_ui', result: open });
    return { intent: 'progress', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'open_reports') {
    assistantText = 'Abrindo os teus relatórios.';
    cards = [
      {
        id: 'open-reports',
        title: 'Relatórios',
        body: 'Histórico e documentos',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'reports' } },
        secondary_action: null,
      },
    ];
    const open = await dispatchTool(ctx, { name: 'open_ui', args: { target: 'reports' } });
    toolResults.push({ name: 'open_ui', result: open });
    return { intent: 'reports', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'open_videos') {
    assistantText = 'Aqui estão os conteúdos e vídeos disponíveis.';
    cards = [
      {
        id: 'open-videos',
        title: 'Vídeos',
        body: 'Conteúdos educativos',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'videos' } },
        secondary_action: null,
      },
    ];
    const open = await dispatchTool(ctx, { name: 'open_ui', args: { target: 'videos' } });
    toolResults.push({ name: 'open_ui', result: open });
    return { intent: 'videos', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'open_checkin') {
    assistantText = 'Vamos ao check-in semanal.';
    cards = [
      {
        id: 'open-checkin',
        title: 'Check-in',
        body: 'Peso, fotos e questionário',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'checkin' } },
        secondary_action: null,
      },
    ];
    const open = await dispatchTool(ctx, { name: 'open_ui', args: { target: 'checkin' } });
    toolResults.push({ name: 'open_ui', result: open });
    return { intent: 'checkin', assistantText, cards, toolResults, usedLlm: false };
  }

  if (mode === 'complete') {
    const acao = context.proxima_acao;
    if (acao?.type === 'next_meal' && acao.payload?.dieta_id && acao.payload?.meal_key) {
      const result = await dispatchTool(ctx, {
        name: 'complete_meal',
        args: {
          dieta_id: acao.payload.dieta_id,
          meal_key: acao.payload.meal_key,
          plano: acao.payload.plano || 'A',
        },
      });
      toolResults.push({ name: 'complete_meal', result });
      const next = await dispatchTool(ctx, { name: 'get_next_action', args: {} });
      toolResults.push({ name: 'get_next_action', result: next });
      const nextAcao = next?.data;
      const mealName = require('./response-composer').mealLabel(acao.payload.meal_key);
      assistantText = result?.ok
        ? `Registado: ${mealName}. ${nextAcao?.title ? `Próximo: ${nextAcao.title}${nextAcao.description ? ` (${require('./response-composer').mealLabel(nextAcao.description)})` : ''}.` : 'Bom trabalho — estás a acompanhar o plano.'}`
        : `Não consegui registar a refeição${result?.error ? `: ${result.error}` : '.'}`;
      cards = nextAcao ? [cardFromAction(nextAcao)].filter(Boolean) : [];
      return { intent: 'complete', assistantText, cards, toolResults, usedLlm: false };
    }
    if (acao?.type === 'today_workout' && acao.payload?.treino_id) {
      assistantText = 'Vamos ao treino — regista série a série (carga, reps, RPE).';
      cards = [
        {
          id: 'start-guided-workout',
          title: acao.title || 'Treino de hoje',
          body: 'Abrir sessão guiada',
          primary_action: {
            type: 'open_ui',
            name: 'open_ui',
            args: { target: 'treino_sessao', treino_id: acao.payload.treino_id },
          },
          secondary_action: {
            type: 'open_ui',
            name: 'open_ui',
            args: { target: 'treino' },
          },
        },
      ];
      const open = await dispatchTool(ctx, {
        name: 'open_ui',
        args: { target: 'treino_sessao', treino_id: acao.payload.treino_id },
      });
      toolResults.push({ name: 'open_ui', result: open });
      return { intent: 'complete', assistantText, cards, toolResults, usedLlm: false };
    }
    assistantText = 'O que concluíste — a refeição ou o treino?';
    cards = [
      {
        id: 'clarify-meal',
        title: 'Refeição',
        body: 'Ver dieta de hoje',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'dieta' } },
        secondary_action: null,
      },
      {
        id: 'clarify-workout',
        title: 'Treino',
        body: 'Ver treino de hoje',
        primary_action: { type: 'open_ui', name: 'open_ui', args: { target: 'treino' } },
        secondary_action: null,
      },
    ];
    return { intent: 'complete', assistantText, cards, toolResults, usedLlm: false };
  }

  // Próximo treino na agenda (orgânico: "qual é o meu próximo treino?")
  if (mode === 'next_workout') {
    const result = await dispatchTool(ctx, {
      name: 'get_next_workout',
      args: { include_today: true, look_ahead_days: 7 },
    });
    toolResults.push({ name: 'get_next_workout', result });
    const composed = composer.composeNextWorkout({
      nextWorkout: result?.data?.next,
      todayRest: Boolean(result?.data?.today_rest),
    });
    return {
      intent: 'next_workout',
      assistantText: composed.assistantText,
      cards: composed.cards,
      toolResults,
      usedLlm: false,
    };
  }

  // next_action / next_meal / workout_day / start_workout / late / resume
  if (mode === 'workout_day' || mode === 'today_workout' || mode === 'start_workout') {
    const result = await dispatchTool(ctx, {
      name: 'get_today_workout',
      args: {
        date_offset: day.offsetDays,
        date_iso: day.dateIso,
        day_label: day.label,
      },
    });
    toolResults.push({ name: 'get_today_workout', result });
    const treino = result?.data;
    const dayPhrase = day.explicit ? day.label : 'hoje';

    if (treino?.sem_agenda) {
      assistantText = `Não há agenda semanal configurada para saber o treino de ${dayPhrase}. Abre Treinos ou fala com o coach.`;
      cards = [
        composer.cardOpenUi('open-workouts', 'Ver treinos', 'Abrir aba de treinos', 'treino'),
      ];
      return { intent: mode, assistantText, cards, toolResults, usedLlm: false };
    }

    if (treino?.descanso || treino?.descanso_hoje) {
      const nextRes = await dispatchTool(ctx, {
        name: 'get_next_workout',
        args: { include_today: false, look_ahead_days: 7 },
      });
      toolResults.push({ name: 'get_next_workout', result: nextRes });
      const nextAcaoRes = await dispatchTool(ctx, { name: 'get_next_action', args: {} });
      toolResults.push({ name: 'get_next_action', result: nextAcaoRes });
      const composed = composer.composeRestDay({
        dayPhrase,
        nextWorkout: nextRes?.data?.next,
        proximaAcao: nextAcaoRes?.data || context.proxima_acao,
      });
      return {
        intent: mode,
        assistantText: composed.assistantText,
        cards: composed.cards,
        toolResults,
        usedLlm: false,
      };
    }

    if (!treino?.detalhe?.id && !treino?.detalhe?.nome) {
      const nextRes = await dispatchTool(ctx, {
        name: 'get_next_workout',
        args: { include_today: true, look_ahead_days: 7 },
      });
      toolResults.push({ name: 'get_next_workout', result: nextRes });
      if (nextRes?.data?.found) {
        const composed = composer.composeNextWorkout({
          nextWorkout: nextRes.data.next,
          todayRest: true,
        });
        return {
          intent: mode,
          assistantText: composed.assistantText,
          cards: composed.cards,
          toolResults,
          usedLlm: false,
        };
      }
      assistantText = `Não há treino atribuído para ${dayPhrase}.`;
      cards = [composer.cardOpenUi('open-workouts', 'Ver treinos', '', 'treino')];
      return { intent: mode, assistantText, cards, toolResults, usedLlm: false };
    }

    const canStartToday = day.offsetDays === 0;
    if (mode === 'start_workout' && canStartToday) {
      const open = await dispatchTool(ctx, {
        name: 'open_ui',
        args: { target: 'treino_sessao', treino_id: treino.detalhe.id },
      });
      toolResults.push({ name: 'open_ui', result: open });
    }

    const composed = composer.composeWorkoutDay({
      dayPhrase,
      treino,
      canStartToday,
      mode,
    });
    return {
      intent: mode === 'start_workout' ? 'start_workout' : 'workout_day',
      assistantText: composed.assistantText,
      cards: composed.cards,
      toolResults,
      usedLlm: false,
    };
  }

  if (mode === 'next_meal') {
    const result = await dispatchTool(ctx, { name: 'get_next_action', args: { prefer: 'meal' } });
    toolResults.push({ name: 'get_next_action', result });
    const composed = composer.composeMeal({ acao: result?.data || context.proxima_acao });
    return {
      intent: 'next_meal',
      assistantText: composed.assistantText,
      cards: composed.cards,
      toolResults,
      usedLlm: false,
    };
  }

  const tone = mode === 'late' ? 'late' : mode === 'resume' ? 'resume' : 'normal';
  const result = await dispatchTool(ctx, { name: 'get_next_action', args: {} });
  toolResults.push({ name: 'get_next_action', result });
  const acao = result?.data || context.proxima_acao;
  const composed = composer.composeNextAction({ acao, tone });
  intent =
    mode === 'late'
      ? 'late'
      : mode === 'resume'
        ? 'resume'
        : acao?.type === 'next_meal'
          ? 'next_meal'
          : 'next_action';
  return {
    intent,
    assistantText: composed.assistantText,
    cards: composed.cards,
    toolResults,
    usedLlm: false,
  };
}

async function tryLlmPlan(intentRaw, context) {
  try {
    const aiManager = require('../ai');
    if (!aiManager.isAvailable || !aiManager.isAvailable()) return null;

    const userPrompt = JSON.stringify({
      mensagem_aluno: intentRaw,
      contexto: context,
      tools: listToolsForPrompt(),
    });

    const raw = await aiManager.extractStructuredData(
      '',
      SYSTEM_PROMPT_V1,
      userPrompt,
      null,
    );
    if (!raw || typeof raw !== 'object') return null;
    return {
      intent: raw.intent || 'other',
      assistant_text: raw.assistant_text || '',
      tool_calls: Array.isArray(raw.tool_calls) ? raw.tool_calls.slice(0, TOOL_LOOP_CAP) : [],
      cards: Array.isArray(raw.cards) ? raw.cards : [],
      provider: aiManager.providerName || null,
      model: aiManager.config?.model || null,
    };
  } catch (err) {
    console.warn('agent LLM plan skipped:', err.message);
    return null;
  }
}

/**
 * Processa uma mensagem do aluno.
 */
async function handleStudentMessage(pool, {
  session,
  aluno,
  userId,
  paymentStatus,
  intentRaw,
  autonomyMax = 2,
  mealKeys = null,
}) {
  const started = Date.now();
  const context = await buildStudentAgentContext(pool, {
    aluno,
    userId,
    paymentStatus,
    mealKeys,
  });

  const run = await agentRepo.createRun(pool, {
    session_id: session.id,
    aluno_id: aluno.id,
    intent_raw: intentRaw,
    autonomy_max: autonomyMax,
    context_snapshot: context,
  });

  await agentRepo.insertMessage(pool, {
    session_id: session.id,
    role: 'user',
    content: intentRaw,
    run_id: run.id,
  });

  const ctx = {
    pool,
    aluno,
    userId,
    coachId: aluno.coach_id,
    runId: run.id,
    sessionId: session.id,
    autonomyMax,
    accessBlocked: Boolean(context.acesso?.blocked),
    paymentStatus,
    mealKeys,
    origin: 'agent',
  };

  let plan;
  const fast = classifyFastPath(intentRaw);
  if (fast) {
    plan = await runFastPath(ctx, fast.mode, context, {
      day: fast.day,
      peso_kg: fast.peso_kg,
    });
  } else {
    const llm = await tryLlmPlan(intentRaw, context);
    if (llm) {
      const toolResults = [];
      for (const call of llm.tool_calls || []) {
        if (!call?.name) continue;
        // Se o LLM pedir treino sem data, injeta o dia parseado da mensagem
        const args = { ...(call.args || {}) };
        if (call.name === 'get_today_workout' && args.date_offset == null && !args.date_iso) {
          const day = parseRelativeDay(intentRaw);
          args.date_offset = day.offsetDays;
          args.date_iso = day.dateIso;
          args.day_label = day.label;
        }
        const result = await dispatchTool(ctx, {
          name: call.name,
          args,
        });
        toolResults.push({ name: call.name, result });
      }
      plan = {
        intent: llm.intent,
        assistantText: llm.assistant_text || 'Pronto.',
        cards: llm.cards || [],
        toolResults,
        usedLlm: true,
        provider: llm.provider,
        model: llm.model,
      };
    } else {
      plan = await runFastPath(ctx, 'next_action', context);
    }
  }

  const assistantMsg = await agentRepo.insertMessage(pool, {
    session_id: session.id,
    role: 'assistant',
    content: plan.assistantText,
    payload: { cards: plan.cards, tool_results: plan.toolResults, intent: plan.intent },
    run_id: run.id,
  });

  await agentRepo.touchSession(pool, session.id);

  const tokensIn = estimateTokensFromText(intentRaw) + estimateTokensFromText(JSON.stringify(context));
  const tokensOut = estimateTokensFromText(plan.assistantText);
  const finished = await agentRepo.finishRun(pool, run.id, {
    status: 'succeeded',
    intent_classified: plan.intent,
    provider: plan.usedLlm ? plan.provider || null : 'fast_path',
    model: plan.usedLlm ? plan.model || null : 'deterministic',
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_estimate_usd: plan.usedLlm
      ? estimateCostUsd({ model: plan.model, tokensIn, tokensOut })
      : 0,
    latency_ms: Date.now() - started,
  });

  return {
    session_id: session.id,
    run_id: run.id,
    message: assistantMsg,
    intent: plan.intent,
    assistant_text: plan.assistantText,
    cards: plan.cards,
    tool_results: plan.toolResults,
    used_llm: Boolean(plan.usedLlm),
    run: finished,
  };
}

async function getOrCreateSession(pool, { aluno, userId, channel = 'student_hoje' }) {
  const existing = await agentRepo.getOpenSession(pool, {
    userId,
    alunoId: aluno.id,
    channel,
  });
  if (existing) return existing;
  return agentRepo.createSession(pool, {
    aluno_id: aluno.id,
    coach_id: aluno.coach_id || null,
    user_id: userId,
    channel,
  });
}

module.exports = {
  classifyFastPath,
  cardFromAction,
  handleStudentMessage,
  getOrCreateSession,
  TOOL_LOOP_CAP,
};
