/**
 * Tools ACTION (UI / approvals).
 */
const { z } = require('zod');
const { AUTONOMY } = require('../policy');
const agentRepo = require('../../../repositories/agent.repository');

function ok(data, ui_hints = []) {
  return { ok: true, data, ui_hints };
}

const OPEN_UI_TARGETS = new Set([
  'hoje',
  'dieta',
  'treino',
  'treino_sessao',
  'meal_photo',
  'checkin',
  'coach_chat',
  'progress',
  'progress_photos',
  'reports',
  'videos',
  'profile',
  'blocked_financial',
  'blocked_operational',
]);

const actionTools = [
  {
    name: 'open_ui',
    description: 'Deep-link para ecrã do portal aluno',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: true,
    reversible: false,
    inputSchema: z
      .object({
        target: z.string().min(1),
        meal_key: z.string().optional(),
        treino_id: z.string().uuid().optional(),
      })
      .strict(),
    async execute(_ctx, args) {
      if (!OPEN_UI_TARGETS.has(args.target)) {
        const err = new Error(`target inválido: ${args.target}`);
        err.statusCode = 400;
        throw err;
      }
      return ok(
        { target: args.target, meal_key: args.meal_key || null, treino_id: args.treino_id || null },
        [
          {
            type: 'action_card',
            title: 'Abrir ecrã',
            actions: [{ type: 'open_ui', name: 'open_ui', args }],
          },
        ],
      );
    },
  },
  {
    name: 'schedule_reminder',
    description: 'Agenda lembrete simples (metadata; sem push externo no MVP foundation)',
    autonomy: AUTONOMY.WRITE_LOW,
    idempotent: false,
    reversible: false,
    inputSchema: z
      .object({
        title: z.string().min(1).max(200),
        when_iso: z.string().optional(),
        note: z.string().max(500).optional(),
      })
      .strict(),
    async execute(ctx, args) {
      return ok({
        scheduled: true,
        title: args.title,
        when_iso: args.when_iso || null,
        note: args.note || null,
        aluno_id: ctx.aluno.id,
      });
    },
  },
  {
    name: 'draft_message_to_coach',
    description: 'Cria rascunho de mensagem ao coach (requer aprovação)',
    autonomy: AUTONOMY.APPROVAL,
    idempotent: false,
    reversible: true,
    inputSchema: z
      .object({
        draft: z.string().min(1).max(2000),
      })
      .strict(),
    async execute(ctx, args) {
      const approval = await agentRepo.createApproval(ctx.pool, {
        run_id: ctx.runId,
        session_id: ctx.sessionId,
        action_type: 'send_message_to_coach',
        payload: { draft: args.draft },
      });
      return ok({
        approval_id: approval.id,
        status: 'pending',
        draft: args.draft,
      }, [
        {
          type: 'action_card',
          title: 'Enviar ao coach?',
          body: args.draft,
          actions: [
            { type: 'approve', name: 'approve', args: { approval_id: approval.id } },
            { type: 'reject', name: 'reject', args: { approval_id: approval.id } },
          ],
        },
      ]);
    },
  },
];

/** Tools HIGH IMPACT — registadas só para recusa explícita */
const highImpactTools = [
  {
    name: 'modify_diet',
    description: 'Alterar dieta (proibido ao agente aluno)',
    autonomy: AUTONOMY.HUMAN_ONLY,
    idempotent: false,
    reversible: false,
    inputSchema: z.object({}).passthrough(),
    async execute() {
      const err = new Error('Acção proibida: só o coach altera a dieta');
      err.statusCode = 403;
      throw err;
    },
  },
  {
    name: 'modify_workout',
    description: 'Alterar treino (proibido ao agente aluno)',
    autonomy: AUTONOMY.HUMAN_ONLY,
    idempotent: false,
    reversible: false,
    inputSchema: z.object({}).passthrough(),
    async execute() {
      const err = new Error('Acção proibida: só o coach altera o treino');
      err.statusCode = 403;
      throw err;
    },
  },
];

module.exports = { actionTools, highImpactTools, OPEN_UI_TARGETS };
