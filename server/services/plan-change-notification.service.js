/**
 * Avisos ao aluno quando o profissional altera dieta ou treino.
 *
 * Fluxo: a rota grava a alteração → schedule() regista/actualiza uma linha pendente
 * (uma por aluno+domínio, com debounce) → o job chama dispatchDue() depois da janela de
 * silêncio → numa transacção grava o aviso em public.notificacoes e, se o aluno aceita
 * e-mail, coloca o e-mail em public.email_queue → depois do COMMIT emite o Socket.io.
 *
 * Estados registados em public.plan_change_notifications:
 *   in_app_status: created = linha em notificacoes (a leitura fica em notificacoes.lida)
 *   email_status:  queued = entregue à fila; o envio SMTP fica em email_queue.status
 */

const logger = require('../utils/logger');
const { getAuthUserIdForAluno } = require('../utils/aluno-auth-user');
const { enqueueEmail } = require('../utils/email-queue');
const { buildStudentNotificationEmail } = require('../utils/student-notification-email-templates');
const { buildTransactionalEmailHtml } = require('../utils/transactional-email-html');

const DOMINIOS = new Set(['dieta', 'treino']);
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_SEC = [60, 300, 900, 1800];
const STALE_PROCESSING_SEC = 300;
const PENDING_SIBLING_SQL = `SELECT 1 FROM public.plan_change_notifications s
  WHERE s.aluno_id = p.aluno_id AND s.dominio = p.dominio AND s.status = 'pending' AND s.id <> p.id`;

const COPY = {
  dieta: {
    tipo: 'dieta_atualizada',
    titulo: 'Plano alimentar atualizado',
    mensagem:
      'Seu profissional realizou uma atualização no seu plano alimentar. Acesse sua dieta para conferir as alterações.',
    link: 'diet',
  },
  treino: {
    tipo: 'treino_atualizado',
    titulo: 'Treino atualizado',
    mensagem: 'Seu treino foi atualizado. Confira as novas orientações na plataforma.',
    link: 'workouts',
  },
};

function readSeconds(envName, fallback) {
  const n = Number(process.env[envName]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

class PlanChangeNotificationService {
  /**
   * @param {import('pg').Pool} pool
   * @param {{ websocket?: { emitToUser: Function, emitToAluno?: Function } | null }} [opts]
   */
  constructor(pool, opts = {}) {
    this.pool = pool;
    this.ws = opts.websocket || null;
    this.debounceSec = readSeconds('PLAN_CHANGE_DEBOUNCE_SEC', 60);
    this.maxWaitSec = readSeconds('PLAN_CHANGE_MAX_WAIT_SEC', 600);
  }

  setWebsocket(ws) {
    this.ws = ws || null;
  }

  /**
   * Regista uma alteração já persistida. Nunca lança: falhar o aviso não pode falhar a gravação.
   * @param {{ dominio: 'dieta'|'treino', alunoId: string, entityId?: string|null, coachId?: string|null, source?: string }} input
   * @returns {Promise<{ id: string, due_at: string, change_count: number } | null>}
   */
  async schedule({ dominio, alunoId, entityId = null, coachId = null, source = null }) {
    if (!DOMINIOS.has(dominio) || !alunoId) return null;
    try {
      const r = await this.pool.query(
        `INSERT INTO public.plan_change_notifications
           (aluno_id, coach_id, dominio, entity_ids, due_at, metadata)
         VALUES (
           $1, $2, $3,
           CASE WHEN $4::uuid IS NULL THEN '{}'::uuid[] ELSE ARRAY[$4::uuid] END,
           now() + make_interval(secs => $5),
           jsonb_build_object('sources', jsonb_build_array($6::text))
         )
         ON CONFLICT (aluno_id, dominio) WHERE status = 'pending'
         DO UPDATE SET
           entity_ids = ARRAY(
             SELECT DISTINCT e FROM unnest(plan_change_notifications.entity_ids || EXCLUDED.entity_ids) AS e
           ),
           change_count = plan_change_notifications.change_count + 1,
           last_change_at = now(),
           due_at = LEAST(
             now() + make_interval(secs => $5),
             plan_change_notifications.first_change_at + make_interval(secs => $7)
           ),
           coach_id = COALESCE(EXCLUDED.coach_id, plan_change_notifications.coach_id),
           metadata = jsonb_set(
             plan_change_notifications.metadata,
             '{sources}',
             (COALESCE(plan_change_notifications.metadata->'sources', '[]'::jsonb) || to_jsonb($6::text))
           ),
           updated_at = now()
         RETURNING id, due_at, change_count`,
        [alunoId, coachId, dominio, entityId, this.debounceSec, source || 'unknown', this.maxWaitSec],
      );
      const row = r.rows[0] || null;
      logger.info('plan_change.scheduled', {
        id: row?.id,
        dominio,
        alunoId,
        entityId,
        source,
        changeCount: row?.change_count,
        dueAt: row?.due_at,
      });
      return row;
    } catch (error) {
      logger.error('plan_change.schedule_failed', {
        dominio,
        alunoId,
        entityId,
        source,
        error: error.message,
      });
      return null;
    }
  }

  /** Agenda aviso de dieta a partir do id da dieta (resolve o aluno). */
  async scheduleForDieta(dietaId, { coachId = null, source = null } = {}) {
    if (!dietaId) return null;
    try {
      const r = await this.pool.query(
        'SELECT id, aluno_id FROM public.dietas WHERE id = $1 LIMIT 1',
        [dietaId],
      );
      const dieta = r.rows[0];
      if (!dieta?.aluno_id) return null;
      return this.schedule({ dominio: 'dieta', alunoId: dieta.aluno_id, entityId: dieta.id, coachId, source });
    } catch (error) {
      logger.error('plan_change.schedule_dieta_failed', { dietaId, source, error: error.message });
      return null;
    }
  }

  /** Agenda aviso de treino para todos os alunos com vínculo activo a um template. */
  async scheduleForTreinoTemplate(treinoId, { coachId = null, source = null } = {}) {
    if (!treinoId) return [];
    try {
      const r = await this.pool.query(
        `SELECT id, aluno_id FROM public.alunos_treinos
         WHERE treino_id = $1 AND COALESCE(ativo, true) = true`,
        [treinoId],
      );
      const out = [];
      for (const link of r.rows) {
        out.push(
          await this.schedule({ dominio: 'treino', alunoId: link.aluno_id, entityId: link.id, coachId, source }),
        );
      }
      return out;
    } catch (error) {
      logger.error('plan_change.schedule_treino_template_failed', { treinoId, source, error: error.message });
      return [];
    }
  }

  async _releaseStale() {
    // Se entretanto entrou uma alteração nova (linha pending do mesmo aluno+domínio), é ela que avisa.
    await this.pool.query(
      `UPDATE public.plan_change_notifications p
       SET status = CASE WHEN EXISTS (${PENDING_SIBLING_SQL}) THEN 'cancelled' ELSE 'pending' END,
           last_error = CASE WHEN EXISTS (${PENDING_SIBLING_SQL}) THEN 'superseded_by_newer_change'
                             ELSE COALESCE(p.last_error, 'processing_timeout') END,
           updated_at = now()
       WHERE p.status = 'processing'
         AND p.updated_at < now() - make_interval(secs => $1)`,
      [STALE_PROCESSING_SEC],
    );
  }

  async _claimDue(limit) {
    const r = await this.pool.query(
      `UPDATE public.plan_change_notifications
       SET status = 'processing', attempts = attempts + 1, updated_at = now()
       WHERE id IN (
         SELECT id FROM public.plan_change_notifications
         WHERE status = 'pending' AND due_at <= now()
         ORDER BY due_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit],
    );
    return r.rows;
  }

  /**
   * Processa avisos vencidos. Chamado pelo job.
   * @returns {Promise<{ processed: number, sent: number, cancelled: number, retried: number, failed: number }>}
   */
  async dispatchDue(limit = 20) {
    const stats = { processed: 0, sent: 0, cancelled: 0, retried: 0, failed: 0 };
    await this._releaseStale().catch((error) => {
      logger.warn('plan_change.release_stale_failed', { error: error.message });
    });
    const rows = await this._claimDue(limit);
    for (const row of rows) {
      stats.processed += 1;
      const outcome = await this.dispatchOne(row);
      if (stats[outcome] != null) stats[outcome] += 1;
    }
    return stats;
  }

  async _loadAluno(alunoId) {
    const r = await this.pool.query(
      `SELECT id, nome, email, coach_id, notification_channel::text AS notification_channel
       FROM public.alunos WHERE id = $1 LIMIT 1`,
      [alunoId],
    );
    return r.rows[0] || null;
  }

  async _liveEntities(row) {
    if (!row.entity_ids?.length) return [];
    if (row.dominio === 'dieta') {
      // Mesmo critério do portal (pickActiveDieta): a dieta ativa ou, sem nenhuma ativa, a mais recente.
      // Alterar uma dieta futura/arquivada não muda o que o aluno vê, por isso não gera aviso.
      const r = await this.pool.query(
        `SELECT id, nome FROM (
           SELECT id, nome FROM public.dietas
           WHERE aluno_id = $2
           ORDER BY (ativa IS TRUE) DESC, created_at DESC NULLS LAST
           LIMIT 1
         ) visible
         WHERE id = ANY($1::uuid[])`,
        [row.entity_ids, row.aluno_id],
      );
      return r.rows;
    }
    const r = await this.pool.query(
      `SELECT at.id, t.nome
       FROM public.alunos_treinos at
       LEFT JOIN public.treinos t ON t.id = at.treino_id
       WHERE at.id = ANY($1::uuid[]) AND at.aluno_id = $2 AND COALESCE(at.ativo, true) = true`,
      [row.entity_ids, row.aluno_id],
    );
    return r.rows;
  }

  async _finish(id, status, fields = {}) {
    await this.pool.query(
      `UPDATE public.plan_change_notifications
       SET status = $2, last_error = $3, updated_at = now()
       WHERE id = $1`,
      [id, status, fields.lastError ?? null],
    );
  }

  async _resolveEmail(recipientUserId, aluno) {
    if (recipientUserId) {
      const r = await this.pool.query('SELECT email FROM app_auth.users WHERE id = $1 LIMIT 1', [
        recipientUserId,
      ]);
      const email = r.rows[0]?.email;
      if (email && String(email).includes('@')) return String(email).trim();
    }
    const fallback = aluno.email && String(aluno.email).trim();
    if (fallback && fallback.includes('@') && !fallback.endsWith('@blackhouse.local')) return fallback;
    return null;
  }

  /**
   * @returns {Promise<'sent'|'cancelled'|'retried'|'failed'>}
   */
  async dispatchOne(row) {
    const copy = COPY[row.dominio];
    const logCtx = { id: row.id, dominio: row.dominio, alunoId: row.aluno_id, attempt: row.attempts };

    let client = null;
    try {
      const aluno = await this._loadAluno(row.aluno_id);
      if (!aluno) {
        await this._finish(row.id, 'cancelled', { lastError: 'aluno_not_found' });
        logger.warn('plan_change.cancelled', { ...logCtx, reason: 'aluno_not_found' });
        return 'cancelled';
      }

      const live = await this._liveEntities(row);
      if (row.entity_ids?.length && live.length === 0) {
        await this._finish(row.id, 'cancelled', { lastError: 'entity_removed_or_not_visible' });
        logger.info('plan_change.cancelled', { ...logCtx, reason: 'entity_removed_or_not_visible' });
        return 'cancelled';
      }

      const coachId = aluno.coach_id || row.coach_id;
      if (!coachId) {
        await this._finish(row.id, 'cancelled', { lastError: 'aluno_sem_coach' });
        logger.warn('plan_change.cancelled', { ...logCtx, reason: 'aluno_sem_coach' });
        return 'cancelled';
      }

      const recipientUserId = await getAuthUserIdForAluno(this.pool, aluno.id);

      let emailTo = null;
      let emailStatus = 'skipped_preference';
      if (aluno.notification_channel !== 'in_app_only') {
        emailTo = await this._resolveEmail(recipientUserId, aluno);
        emailStatus = emailTo ? 'queued' : 'skipped_no_email';
      }

      const entityNames = live.map((e) => e.nome).filter(Boolean);
      const notifMetadata = {
        plan_change_id: row.id,
        dominio: row.dominio,
        entity_ids: row.entity_ids,
        change_count: row.change_count,
      };

      client = await this.pool.connect();
      await client.query('BEGIN');

      const notif = await client.query(
        `INSERT INTO public.notificacoes
           (coach_id, aluno_id, tipo, titulo, mensagem, lida, link, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, $7::jsonb, now(), now())
         RETURNING id, created_at`,
        [coachId, aluno.id, copy.tipo, copy.titulo, copy.mensagem, copy.link, JSON.stringify(notifMetadata)],
      );
      const notificacaoId = notif.rows[0].id;

      let emailQueueId = null;
      if (emailTo) {
        const built = buildStudentNotificationEmail(copy.tipo, {
          alunoNome: aluno.nome || '',
          planoNome: entityNames[0] || '',
        });
        emailQueueId = await enqueueEmail(client, {
          to: emailTo,
          subject: built.subject,
          text: built.text,
          html: buildTransactionalEmailHtml(built.htmlPayload),
          metadata: { plan_change_id: row.id, tipo: copy.tipo, aluno_id: aluno.id },
        });
      }

      await client.query(
        `UPDATE public.plan_change_notifications
         SET status = 'sent',
             recipient_user_id = $2,
             notificacao_id = $3,
             in_app_status = 'created',
             email_status = $4,
             email_queue_id = $5,
             dispatched_at = now(),
             last_error = NULL,
             updated_at = now()
         WHERE id = $1`,
        [row.id, recipientUserId, notificacaoId, emailStatus, emailQueueId],
      );
      await client.query('COMMIT');
      client.release();
      client = null;

      const socketEmitted = this._emit(copy, { recipientUserId, alunoId: aluno.id, row, notificacaoId });
      if (socketEmitted) {
        await this.pool
          .query('UPDATE public.plan_change_notifications SET socket_emitted = true WHERE id = $1', [row.id])
          .catch(() => {});
      }

      logger.info('plan_change.dispatched', {
        ...logCtx,
        notificacaoId,
        recipientUserId,
        emailStatus,
        emailQueueId,
        socketEmitted,
        changeCount: row.change_count,
      });
      return 'sent';
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
      const exhausted = row.attempts >= MAX_ATTEMPTS;
      const delay = RETRY_DELAYS_SEC[Math.min(row.attempts - 1, RETRY_DELAYS_SEC.length - 1)] || 60;
      let outcome = exhausted ? 'failed' : 'retried';
      try {
        const upd = await this.pool.query(
          `UPDATE public.plan_change_notifications p
           SET status = CASE
                 WHEN $2 = 'failed' THEN 'failed'
                 WHEN EXISTS (${PENDING_SIBLING_SQL}) THEN 'cancelled'
                 ELSE 'pending' END,
               in_app_status = CASE WHEN $2 = 'failed' THEN 'failed' ELSE p.in_app_status END,
               last_error = CASE
                 WHEN $2 <> 'failed' AND EXISTS (${PENDING_SIBLING_SQL}) THEN 'superseded_by_newer_change'
                 ELSE $3 END,
               due_at = now() + make_interval(secs => $4),
               updated_at = now()
           WHERE p.id = $1
           RETURNING p.status`,
          [row.id, exhausted ? 'failed' : 'pending', String(error.message || error).slice(0, 1000), delay],
        );
        if (upd.rows[0]?.status === 'cancelled') outcome = 'cancelled';
      } catch (updateErr) {
        logger.error('plan_change.status_update_failed', { ...logCtx, error: updateErr.message });
      }
      const log = exhausted ? logger.error : logger.warn;
      log.call(logger, exhausted ? 'plan_change.failed' : 'plan_change.retry_scheduled', {
        ...logCtx,
        error: error.message,
        outcome,
        retryInSec: outcome === 'retried' ? delay : null,
      });
      return outcome;
    }
  }

  _emit(copy, { recipientUserId, alunoId, row, notificacaoId }) {
    if (!this.ws) return false;
    const payload = {
      type: copy.tipo,
      title: copy.titulo,
      message: copy.mensagem,
      data: { link: copy.link, alunoId, notificacaoId, planChangeId: row.id },
      timestamp: new Date().toISOString(),
    };
    try {
      if (recipientUserId && typeof this.ws.emitToUser === 'function') {
        this.ws.emitToUser(recipientUserId, 'notification', payload);
        return true;
      }
      if (typeof this.ws.emitToAluno === 'function') {
        this.ws.emitToAluno(alunoId, 'notification', payload);
        return true;
      }
    } catch (error) {
      logger.warn('plan_change.socket_emit_failed', { id: row.id, error: error.message });
    }
    return false;
  }

  /**
   * Últimos avisos de um aluno, com o estado real de cada canal (para o profissional).
   */
  async listForAluno(alunoId, { limit = 10 } = {}) {
    const r = await this.pool.query(
      `SELECT p.id, p.dominio, p.status, p.change_count, p.first_change_at, p.last_change_at,
              p.due_at, p.dispatched_at, p.attempts, p.last_error,
              p.in_app_status, p.email_status, p.socket_emitted,
              n.lida AS notificacao_lida,
              n.updated_at AS notificacao_atualizada_em,
              e.status AS email_queue_status,
              e.sent_at AS email_sent_at,
              e.last_error AS email_last_error
       FROM public.plan_change_notifications p
       LEFT JOIN public.notificacoes n ON n.id = p.notificacao_id
       LEFT JOIN public.email_queue e ON e.id = p.email_queue_id
       WHERE p.aluno_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [alunoId, Math.min(Math.max(Number(limit) || 10, 1), 50)],
    );
    return r.rows.map(presentStatus);
  }
}

/**
 * Traduz o registo para estados honestos por canal.
 * in_app: pending | created | read | failed
 * email:  pending | queued | sent_to_provider | failed | skipped_preference | skipped_no_email | unknown
 */
function presentStatus(row) {
  let inApp = row.in_app_status;
  if (inApp === 'created' && row.notificacao_lida === true) inApp = 'read';

  let email = row.email_status;
  if (email === 'queued') {
    if (row.email_queue_status === 'sent') email = 'sent_to_provider';
    else if (row.email_queue_status === 'dead') email = 'failed';
    else if (row.email_queue_status == null && row.status === 'sent') email = 'unknown';
  }

  return {
    id: row.id,
    dominio: row.dominio,
    status: row.status,
    change_count: row.change_count,
    first_change_at: row.first_change_at,
    last_change_at: row.last_change_at,
    due_at: row.due_at,
    dispatched_at: row.dispatched_at,
    attempts: row.attempts,
    last_error: row.last_error,
    in_app: inApp,
    email,
    email_sent_at: row.email_sent_at || null,
    email_error: row.email_last_error || null,
    realtime_emitted: row.socket_emitted,
  };
}

let defaultInstance = null;

function getPlanChangeNotifier(pool) {
  if (!defaultInstance && pool) defaultInstance = new PlanChangeNotificationService(pool);
  return defaultInstance;
}

module.exports = {
  PlanChangeNotificationService,
  getPlanChangeNotifier,
  presentStatus,
  COPY,
  MAX_ATTEMPTS,
};
