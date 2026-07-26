/**
 * Tools READ de contexto (autonomia 0).
 */
const { z } = require('zod');
const { AUTONOMY } = require('../policy');
const { buildStudentAgentContext } = require('../context-builder');
const { getAlunoHoje } = require('../../aluno-hoje.service');
const { getProximaAcao } = require('../../proxima-acao.service');

function ok(data, ui_hints = []) {
  return { ok: true, data, ui_hints };
}

const readTools = [
  {
    name: 'get_student_context',
    description: 'Contexto allowlist do aluno para o dia',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z.object({}).strict(),
    async execute(ctx) {
      const data = await buildStudentAgentContext(ctx.pool, {
        aluno: ctx.aluno,
        userId: ctx.userId,
        paymentStatus: ctx.paymentStatus,
        mealKeys: ctx.mealKeys,
      });
      return ok(data);
    },
  },
  {
    name: 'get_today_plan',
    description: 'Resumo do plano de hoje (dieta + treino)',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z.object({}).strict(),
    async execute(ctx) {
      const hoje = await getAlunoHoje(ctx.pool, { aluno: ctx.aluno, userId: ctx.userId });
      return ok({
        dieta: hoje.dieta
          ? { id: hoje.dieta.id, nome: hoje.dieta.nome, plano: hoje.dieta_rotacao?.plano }
          : null,
        treino: hoje.treino,
        execucao: hoje.execucao,
      });
    },
  },
  {
    name: 'get_next_action',
    description: 'Próxima acção determinística do dia (refeição/treino antes do check-in)',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z.object({
      meal_keys: z.array(z.string()).optional(),
      prefer: z.enum(['meal', 'workout']).optional(),
    }).strict(),
    async execute(ctx, args) {
      const acao = await getProximaAcao(ctx.pool, {
        aluno: ctx.aluno,
        userId: ctx.userId,
        mealKeys: args.meal_keys || ctx.mealKeys || null,
        prefer: args.prefer || null,
      });
      return ok(acao);
    },
  },
  {
    name: 'get_today_workout',
    description:
      'Treino (ou descanso) para um dia — hoje por omissão; passa date_offset/date_iso para amanhã etc.',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        date_offset: z.number().int().min(0).max(14).optional(),
        date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        day_label: z.string().optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const agendaService = require('../../aluno-treino-agenda.service');
      const { parseRelativeDay, toIsoDate, WEEKDAY_NAMES } = require('../temporal');

      let targetDate = new Date();
      let label = 'hoje';
      let explicit = false;

      if (args.date_iso) {
        const [y, m, d] = args.date_iso.split('-').map(Number);
        targetDate = new Date(y, m - 1, d);
        label = args.day_label || args.date_iso;
        explicit = true;
      } else if (args.date_offset != null && args.date_offset !== 0) {
        targetDate = new Date();
        targetDate.setHours(0, 0, 0, 0);
        targetDate.setDate(targetDate.getDate() + args.date_offset);
        label = args.day_label || (args.date_offset === 1 ? 'amanhã' : `daqui a ${args.date_offset} dias`);
        explicit = true;
      } else if (args.day_label) {
        label = args.day_label;
        explicit = true;
      }

      const dia = agendaService.isoDayOfWeek(targetDate);
      const dateIso = toIsoDate(targetDate);
      const agenda = await agendaService.listAgenda(ctx.pool, ctx.aluno.id);
      const hasAgenda = agenda.sessions.length > 0;
      const slot = agenda.sessions.find((s) => Number(s.dia_semana) === dia) || null;

      if (slot) {
        return ok({
          date_iso: dateIso,
          day_label: label,
          dia_semana: dia,
          dia_semana_nome: WEEKDAY_NAMES[dia],
          explicit_day: explicit,
          from_agenda: true,
          descanso_hoje: false,
          descanso: false,
          detalhe: {
            id: slot.treino_id,
            nome: slot.treino_nome,
            categoria: slot.treino_categoria,
            dificuldade: slot.treino_dificuldade,
          },
          vinculo: {
            id: slot.aluno_treino_id,
            treino_id: slot.treino_id,
          },
        });
      }

      if (hasAgenda) {
        return ok({
          date_iso: dateIso,
          day_label: label,
          dia_semana: dia,
          dia_semana_nome: WEEKDAY_NAMES[dia],
          explicit_day: explicit,
          from_agenda: true,
          descanso_hoje: true,
          descanso: true,
          detalhe: null,
          vinculo: null,
        });
      }

      // Sem agenda semanal: para "hoje" reutiliza resolução do /hoje; outros dias → honestidade
      if (!explicit || args.date_offset === 0 || (!args.date_iso && !args.date_offset)) {
        const hoje = await getAlunoHoje(ctx.pool, { aluno: ctx.aluno, userId: ctx.userId });
        return ok({
          ...(hoje.treino || {}),
          date_iso: dateIso,
          day_label: label,
          dia_semana: dia,
          dia_semana_nome: WEEKDAY_NAMES[dia],
          explicit_day: explicit,
        });
      }

      return ok({
        date_iso: dateIso,
        day_label: label,
        dia_semana: dia,
        dia_semana_nome: WEEKDAY_NAMES[dia],
        explicit_day: explicit,
        from_agenda: false,
        descanso: false,
        detalhe: null,
        vinculo: null,
        sem_agenda: true,
      });
    },
  },
  {
    name: 'get_next_workout',
    description:
      'Próximo treino na agenda (hoje ou dias seguintes). Use quando o aluno pergunta pelo próximo treino.',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        include_today: z.boolean().optional(),
        look_ahead_days: z.number().int().min(1).max(14).optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const agendaService = require('../../aluno-treino-agenda.service');
      const { toIsoDate, WEEKDAY_NAMES } = require('../temporal');
      const includeToday = args.include_today !== false;
      const lookAhead = args.look_ahead_days || 7;

      const agenda = await agendaService.listAgenda(ctx.pool, ctx.aluno.id);
      if (!agenda.sessions.length) {
        return ok({ found: false, reason: 'sem_agenda', next: null, today_rest: null });
      }

      const byDia = new Map(agenda.sessions.map((s) => [Number(s.dia_semana), s]));
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const todayIso = agendaService.isoDayOfWeek(start);
      const todaySlot = byDia.get(todayIso) || null;

      for (let offset = includeToday ? 0 : 1; offset <= lookAhead; offset += 1) {
        const d = new Date(start);
        d.setDate(d.getDate() + offset);
        const dia = agendaService.isoDayOfWeek(d);
        const slot = byDia.get(dia);
        if (!slot) continue;

        let dayLabel = 'hoje';
        if (offset === 1) dayLabel = 'amanhã';
        else if (offset > 1) dayLabel = WEEKDAY_NAMES[dia];

        return ok({
          found: true,
          today_rest: !todaySlot,
          today_has_workout: Boolean(todaySlot),
          next: {
            offset_days: offset,
            date_iso: toIsoDate(d),
            day_label: dayLabel,
            dia_semana: dia,
            dia_semana_nome: WEEKDAY_NAMES[dia],
            from_agenda: true,
            detalhe: {
              id: slot.treino_id,
              nome: slot.treino_nome,
              categoria: slot.treino_categoria,
              dificuldade: slot.treino_dificuldade,
            },
            vinculo: {
              id: slot.aluno_treino_id,
              treino_id: slot.treino_id,
            },
          },
        });
      }

      return ok({
        found: false,
        reason: 'sem_treino_no_horizonte',
        today_rest: !todaySlot,
        next: null,
      });
    },
  },
  {
    name: 'get_week_agenda',
    description: 'Resumo da agenda semanal de treinos (dias com sessão)',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z.object({}).strict(),
    async execute(ctx) {
      const agendaService = require('../../aluno-treino-agenda.service');
      const { WEEKDAY_NAMES } = require('../temporal');
      const agenda = await agendaService.listAgenda(ctx.pool, ctx.aluno.id);
      const days = (agenda.sessions || []).map((s) => ({
        dia_semana: s.dia_semana,
        dia_semana_nome: WEEKDAY_NAMES[s.dia_semana],
        treino_id: s.treino_id,
        treino_nome: s.treino_nome,
      }));
      return ok({ sessoes_count: agenda.sessoes_count, days });
    },
  },
  {
    name: 'get_meal_detail',
    description: 'Detalhe resumido da refeição actual do contexto',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        meal_key: z.string().min(1).optional(),
        dieta_id: z.string().uuid().optional(),
        plano: z.string().optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const hoje = await getAlunoHoje(ctx.pool, { aluno: ctx.aluno, userId: ctx.userId });
      const dietaId = args.dieta_id || hoje.dieta?.id;
      const mealKey = args.meal_key || null;
      const plano = args.plano || hoje.dieta_rotacao?.plano || 'A';
      if (!dietaId) return ok({ dieta_id: null, meal_key: mealKey, itens: [] });

      const itensRes = await ctx.pool.query(
        `SELECT i.id, i.refeicao, i.quantidade, i.unidade_quantidade, i.alimento_id,
                a.nome AS alimento_nome
         FROM public.itens_dieta i
         LEFT JOIN public.alimentos a ON a.id = i.alimento_id
         WHERE i.dieta_id = $1
         ORDER BY i.refeicao ASC, a.nome ASC NULLS LAST
         LIMIT 200`,
        [dietaId],
      );

      const normalize = (s) =>
        String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .replace(/\s*\(substituto\)\s*$/i, '')
          .trim();

      const keyNorm = mealKey ? normalize(mealKey) : '';
      let itens = itensRes.rows;
      if (keyNorm) {
        const matched = itensRes.rows.filter((r) => {
          const ref = normalize(r.refeicao);
          return ref === keyNorm || ref.includes(keyNorm) || keyNorm.includes(ref);
        });
        if (matched.length) itens = matched;
      } else {
        itens = itensRes.rows.slice(0, 20);
      }

      const preview = itens.slice(0, 12).map((i) => ({
        id: i.id,
        refeicao: i.refeicao,
        nome: i.alimento_nome || 'Alimento',
        quantidade: i.quantidade != null ? Number(i.quantidade) : null,
        unidade: i.unidade_quantidade || 'g',
        alimento_id: i.alimento_id,
      }));

      return ok({
        dieta_id: dietaId,
        meal_key: mealKey,
        plano,
        itens: preview,
        itens_total: itens.length,
        truncated: itens.length > preview.length,
      });
    },
  },
  {
    name: 'list_substitutions',
    description: 'Lista substituições isocalóricas de um alimento',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        alimento_id: z.string().uuid(),
        quantidade: z.number().positive().optional(),
        unidade: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const substService = require('../../refeicao-substituicao.service');
      const data = await substService.listOptions(ctx.pool, {
        alimentoId: args.alimento_id,
        quantidade: args.quantidade,
        unidade: args.unidade,
        limit: args.limit || 8,
      });
      return ok(data, [
        {
          type: 'action_card',
          title: 'Ver na dieta',
          actions: [
            {
              type: 'open_ui',
              name: 'open_ui',
              args: { target: 'dieta' },
            },
          ],
        },
      ]);
    },
  },
  {
    name: 'get_behavioral_insight',
    description: 'Insight de aderência recente (streak, misses, taxas)',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        days: z.number().int().positive().max(30).optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const behavioral = require('../../behavioral-insight.service');
      const data = await behavioral.getBehavioralInsight(ctx.pool, ctx.aluno, {
        days: args.days || 7,
      });
      return ok(data);
    },
  },
  {
    name: 'list_coach_rules',
    description: 'Regras operacionais activas do coach (filosofia / orientações)',
    autonomy: AUTONOMY.READ,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        trigger: z
          .enum([
            'always',
            'restaurant',
            'substitution',
            'workout',
            'late',
            'complete',
            'checkin',
          ])
          .optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const coachRules = require('../../coach-rules.service');
      const coachId = ctx.aluno?.coach_id || ctx.coachId || null;
      const triggers = args.trigger ? [args.trigger] : null;
      const rules = await coachRules.listActiveForAgent(ctx.pool, coachId, {
        triggers,
        limit: 20,
      });
      return ok({ rules, count: rules.length });
    },
  },
];

module.exports = { readTools };
