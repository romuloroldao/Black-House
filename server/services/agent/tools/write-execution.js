/**
 * Tools WRITE de execução diária (autonomia 2).
 */
const { z } = require('zod');
const { AUTONOMY } = require('../policy');
const refeicaoService = require('../../refeicao-conclusao.service');
const treinoService = require('../../treino-sessao.service');

function ok(data, ui_hints = []) {
  return { ok: true, data, ui_hints };
}

const writeTools = [
  {
    name: 'complete_meal',
    description: 'Marca refeição do plano como concluída',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: true,
    reversible: true,
    inputSchema: z
      .object({
        dieta_id: z.string().uuid(),
        meal_key: z.string().min(1),
        plano: z.string().optional(),
        data_ref: z.string().optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const row = await refeicaoService.upsertForAluno(ctx.pool, ctx.aluno.id, ctx.aluno, {
        dieta_id: args.dieta_id,
        meal_key: args.meal_key,
        plano: args.plano || 'A',
        data_ref: args.data_ref,
        concluido: true,
        origem: 'agent',
      });
      return ok(row);
    },
  },
  {
    name: 'uncomplete_meal',
    description: 'Desmarca refeição concluída',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: true,
    reversible: true,
    inputSchema: z
      .object({
        dieta_id: z.string().uuid(),
        meal_key: z.string().min(1),
        plano: z.string().optional(),
        data_ref: z.string().optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const row = await refeicaoService.upsertForAluno(ctx.pool, ctx.aluno.id, ctx.aluno, {
        dieta_id: args.dieta_id,
        meal_key: args.meal_key,
        plano: args.plano || 'A',
        data_ref: args.data_ref,
        concluido: false,
        origem: 'agent',
      });
      return ok(row);
    },
  },
  {
    name: 'log_workout_set',
    description: 'Regista série/carga de um exercício',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        treino_id: z.string().uuid(),
        aluno_treino_id: z.string().uuid().optional(),
        exercise_index: z.number().int().nonnegative(),
        exercise_name: z.string().min(1),
        set_index: z.number().int().positive().optional(),
        carga: z.string().optional(),
        repeticoes: z.number().optional().nullable(),
        rpe: z.number().optional().nullable(),
        dor: z.number().optional().nullable(),
      })
      .strict(),
    async execute(ctx, args) {
      const sessao = await treinoService.startOrGetSession(ctx.pool, ctx.aluno.id, {
        treino_id: args.treino_id,
        aluno_treino_id: args.aluno_treino_id,
        origem: 'agent',
      });
      const serie = await treinoService.upsertSerieLog(ctx.pool, ctx.aluno.id, sessao.id, {
        exercise_index: args.exercise_index,
        exercise_name: args.exercise_name,
        set_index: args.set_index || 1,
        carga: args.carga,
        repeticoes: args.repeticoes,
        rpe: args.rpe,
        dor: args.dor,
        concluido: true,
        origem: 'agent',
      });
      return ok({ sessao_id: sessao.id, serie });
    },
  },
  {
    name: 'complete_workout_session',
    description: 'Marca sessão de treino como completa',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        sessao_id: z.string().uuid().optional(),
        treino_id: z.string().uuid().optional(),
        completed_indexes: z.array(z.number().int()).optional(),
      })
      .strict(),
    async execute(ctx, args) {
      let sessaoId = args.sessao_id;
      if (!sessaoId && args.treino_id) {
        const sessao = await treinoService.startOrGetSession(ctx.pool, ctx.aluno.id, {
          treino_id: args.treino_id,
          origem: 'agent',
        });
        sessaoId = sessao.id;
      }
      if (!sessaoId) {
        const err = new Error('sessao_id ou treino_id obrigatório');
        err.statusCode = 400;
        throw err;
      }
      const updated = await treinoService.patchSession(ctx.pool, ctx.aluno.id, ctx.aluno, sessaoId, {
        status: 'completed',
        completed_indexes: args.completed_indexes,
      });
      return ok(updated);
    },
  },
  {
    name: 'log_body_weight',
    description: 'Regista peso corporal do aluno',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: false,
    reversible: false,
    inputSchema: z
      .object({
        peso_kg: z.number().positive().max(400),
      })
      .strict(),
    async execute(ctx, args) {
      const bodyMetrics = require('../../body-metrics.service');
      if (typeof bodyMetrics.updateAlunoPeso !== 'function') {
        return ok({ skipped: true, reason: 'body_metrics_unavailable', peso_kg: args.peso_kg });
      }
      const client = await ctx.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await bodyMetrics.updateAlunoPeso(
          client,
          ctx.aluno.id,
          args.peso_kg,
          'agent',
        );
        await client.query('COMMIT');
        return ok(result || { peso_kg: args.peso_kg });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  },
  {
    name: 'apply_substitution',
    description: 'Aplica substituição isocalórica a um item do plano (só hoje; não altera o plano do coach)',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: true,
    reversible: true,
    inputSchema: z
      .object({
        dieta_id: z.string().uuid(),
        item_dieta_id: z.string().uuid(),
        alimento_substituto_id: z.string().uuid(),
        quantidade_substituto: z.number().positive().optional(),
        unidade_substituto: z.string().optional(),
        plano: z.string().optional(),
        data_ref: z.string().optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const substService = require('../../refeicao-substituicao.service');
      const row = await substService.applyForAluno(ctx.pool, ctx.aluno.id, {
        ...args,
        origem: 'agent',
      });
      return ok(row, [
        {
          type: 'action_card',
          title: 'Ver dieta actualizada',
          actions: [{ type: 'open_ui', name: 'open_ui', args: { target: 'dieta' } }],
        },
      ]);
    },
  },
  {
    name: 'clear_substitution',
    description: 'Remove substituição do dia e repõe o alimento original do plano',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: true,
    reversible: true,
    inputSchema: z
      .object({
        item_dieta_id: z.string().uuid(),
        plano: z.string().optional(),
        data_ref: z.string().optional(),
      })
      .strict(),
    async execute(ctx, args) {
      const substService = require('../../refeicao-substituicao.service');
      const row = await substService.clearForAluno(ctx.pool, ctx.aluno.id, args);
      return ok(row);
    },
  },
];

module.exports = { writeTools };
