// ============================================================================
// ROTAS DA API REST (/api/*)
// ============================================================================
// Design: Remoção completa do Supabase - 100% VPS PostgreSQL
// Todas as rotas antigas /rest/v1/* devem migrar para /api/*
// ============================================================================

const express = require('express');
const router = express.Router();
const {
  resolveAlunoOrFail: fetchAlunoByUserId,
  resolveCoachByAluno,
  validateAlunoBelongsToCoach,
} = require('../utils/identity-resolver');
const { queryAlunoRowsFullForUser } = require('../utils/aluno-resolve-by-user');
const { getAlunoPortalStatus } = require('../utils/aluno-portal-status');
const { validateUUIDParam, isValidUUID } = require('../utils/uuid-validator');
const resolveAlunoOrFailMiddleware = require('../middleware/resolveAlunoOrFail');
const resolveCoachOrFailMiddleware = require('../middleware/resolveCoachOrFail');
const validateRole = require('../middleware/validateRole');
const createAlimentosRouter = require('./alimentos');
const createUploadsRouter = require('./uploads');
const createEducationalContentsRouter = require('./educational-contents');
const { deleteUserByUserRoleId } = require('../utils/deleteUserByUserRoleId');
const AsaasService = require('../services/asaas.service');
const { encryptCoachAsaasApiKey, decryptCoachAsaasApiKey } = require('../utils/asaas-coach-secret-crypto');

// ============================================================================
// MIDDLEWARES
// ============================================================================

module.exports = function (pool, authenticate, domainSchemaGuard, notificationService = null) {

  // ============================================================================
  // MIDDLEWARES DE RESOLUÇÃO DE DOMÍNIO
  // ============================================================================
  const resolveAlunoOrFail = resolveAlunoOrFailMiddleware(pool);
  const resolveCoachOrFail = resolveCoachOrFailMiddleware(pool);

  /** Aluno canónico para o utilizador (BD com ou sem coluna linked_user_id). */
  async function getAlunoRowForAuthUser(userId) {
    const rows = await queryAlunoRowsFullForUser(pool, userId);
    return rows[0] || null;
  }

  let weeklyCheckinsColCache = null;
  let weeklyCheckinsColCacheAt = 0;
  async function loadWeeklyCheckinsColumns() {
    const now = Date.now();
    if (weeklyCheckinsColCache && now - weeklyCheckinsColCacheAt < 60000) {
      return weeklyCheckinsColCache;
    }
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_checkins'`,
    );
    weeklyCheckinsColCache = new Set(r.rows.map((x) => x.column_name));
    weeklyCheckinsColCacheAt = now;
    return weeklyCheckinsColCache;
  }

  /** BH-CHECKIN-009: padrão ILIKE para ?q= (mín. 2 caracteres). */
  function parseWeeklyCheckinSearchQuery(req) {
    const raw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (raw.length < 2) return null;
    const escaped = raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    return `%${escaped}%`;
  }

  /** Só resolve `req.aluno` quando o utilizador é aluno (coach/admin ignoram). */
  function requireAlunoWhenStudent() {
    return (req, res, next) => {
      if (req.user?.role === 'aluno') {
        return resolveAlunoOrFail(req, res, next);
      }
      return next();
    };
  }

  /** Normaliza vínculo para o JSON (sempre user_id no contrato da API). */
  function alunoRowWithCanonicalUserId(row) {
    if (!row) return row;
    const link = row.link_user_id != null ? row.link_user_id
      : row.linked_user_id != null ? row.linked_user_id
      : row.user_id;
    const { link_user_id: _drop, ...rest } = row;
    return { ...rest, user_id: link };
  }

  // ROTAS: ALIMENTOS (montadas antes de rotas paramétricas)
  router.use('/alimentos', createAlimentosRouter(pool, authenticate, domainSchemaGuard));

  // ROTAS: UPLOADS — PostgreSQL + ficheiros em disco (sem Supabase Storage)
  router.use('/uploads', createUploadsRouter(pool, authenticate));

  // ROTAS: CONTEÚDOS EDUCATIVOS
  router.use('/educational-contents', createEducationalContentsRouter(pool, authenticate, domainSchemaGuard));

  // ============================================================================
  // ROTAS: ALUNOS
  // ============================================================================
  // IMPORTANTE: Rotas semânticas DEVEM vir ANTES de rotas paramétricas
  // ============================================================================

  // GET /api/alunos/me - Retorna o aluno canônico do usuário autenticado
  // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
  router.get('/alunos/me', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
    try {
      const aluno = { ...req.aluno };
      const raw = aluno.plano != null ? String(aluno.plano).trim() : '';
      if (raw) {
        const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
        try {
          if (looksUuid) {
            const pr = await pool.query(
              'SELECT nome FROM public.payment_plans WHERE id = $1::uuid LIMIT 1',
              [raw]
            );
            if (pr.rows[0]?.nome) {
              aluno.plano_nome = pr.rows[0].nome;
            } else {
              aluno.plano_nome = 'Plano de pagamento';
            }
          } else {
            aluno.plano_nome = raw;
          }
        } catch {
          aluno.plano_nome = looksUuid ? 'Plano de pagamento' : raw;
        }
      }
      res.json(aluno);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/alunos/me/hoje — resumo agregado (treino, dieta, pendências, retorno)
  const { getAlunoHoje } = require('../services/aluno-hoje.service');
  router.get(
    '/alunos/me/hoje',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFail,
    async (req, res) => {
      try {
        const payload = await getAlunoHoje(pool, {
          aluno: req.aluno,
          userId: req.user.id,
        });
        return res.json(payload);
      } catch (error) {
        console.error('Erro em GET /api/alunos/me/hoje:', error);
        return res.status(500).json({
          error: error.message || 'Erro ao carregar resumo do dia',
          error_code: 'ALUNO_HOJE_ERROR',
        });
      }
    },
  );

  // POST /api/alunos/link-user - Vincula usuário existente a aluno importado
  // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para coaches
  // DESIGN-LINK-ALUNO-USER-001: Rota semântica para vínculo aluno ↔ user
  const { getAlunoUserLinkColumn } = require('../utils/aluno-link-column');

  const {
    provisionAlunoForUser,
    listUnlinkedRegistrations,
    isValidCoachId,
  } = require('../utils/aluno-signup-provision');

  // GET /api/alunos/unlinked-registrations — cadastros na plataforma sem ficha
  router.get(
    '/alunos/unlinked-registrations',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const rows = await listUnlinkedRegistrations(pool, { limit: 150 });
        res.json(rows);
      } catch (error) {
        console.error('Erro ao listar cadastros sem ficha:', error);
        res.status(500).json({ error: 'Erro ao listar cadastros pendentes', error_code: 'UNLINKED_LIST_ERROR' });
      }
    },
  );

  // DELETE /api/alunos/dismiss-registration — remove cadastro sem ficha (credencial órfã)
  router.post(
    '/alunos/dismiss-registration',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const { userIdToDismiss } = req.body || {};
        if (!userIdToDismiss || !isValidUUID(String(userIdToDismiss))) {
          return res.status(400).json({
            error: 'userIdToDismiss é obrigatório e deve ser UUID válido',
            error_code: 'INVALID_USER_ID',
          });
        }

        const linkCol = await getAlunoUserLinkColumn(pool);
        const stillHasAluno = await pool.query(
          `SELECT id FROM public.alunos WHERE ${linkCol} = $1 LIMIT 1`,
          [userIdToDismiss],
        );
        if (stillHasAluno.rows.length > 0) {
          return res.status(409).json({
            error: 'Este utilizador ainda tem ficha de aluno. Exclua pela gestão de alunos.',
            error_code: 'ALUNO_STILL_EXISTS',
            aluno_id: stillHasAluno.rows[0].id,
          });
        }

        const userRow = await pool.query(
          'SELECT id, email FROM app_auth.users WHERE id = $1',
          [userIdToDismiss],
        );
        if (userRow.rows.length === 0) {
          return res.status(404).json({ error: 'Usuário não encontrado', error_code: 'USER_NOT_FOUND' });
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { deleteAuthUserForAluno } = require('../utils/delete-aluno-complete');
          const removed = await deleteAuthUserForAluno(client, {
            email: userRow.rows[0].email,
            authUserId: userIdToDismiss,
          });
          await client.query('COMMIT');
          if (!removed.removed) {
            return res.status(400).json({
              error: 'Não foi possível remover este cadastro (perfil protegido ou inexistente).',
              error_code: 'DISMISS_FAILED',
            });
          }
          res.json({ success: true, message: 'Cadastro removido da plataforma.' });
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Erro ao dispensar cadastro:', error);
        res.status(500).json({ error: 'Erro ao remover cadastro', error_code: 'DISMISS_ERROR' });
      }
    },
  );

  // POST /api/alunos/adopt-registration — coach cria ficha e vincula cadastro existente
  router.post(
    '/alunos/adopt-registration',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const { userIdToLink, full_name: fullName } = req.body || {};
        const coachId = req.user.id;

        if (!userIdToLink || !isValidCoachId(userIdToLink)) {
          return res.status(400).json({
            error: 'userIdToLink é obrigatório e deve ser um UUID válido',
            error_code: 'INVALID_USER_ID',
          });
        }

        const userResult = await pool.query(
          'SELECT id, email, email_confirmed_at FROM app_auth.users WHERE id = $1',
          [userIdToLink],
        );
        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'Usuário não encontrado', error_code: 'USER_NOT_FOUND' });
        }

        const roleCheck = await pool.query(
          `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'aluno'`,
          [userIdToLink],
        );
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({
            error: 'Usuário não possui perfil de aluno na plataforma',
            error_code: 'NOT_STUDENT_ROLE',
          });
        }

        const linkCol = await getAlunoUserLinkColumn(pool);
        const alreadyLinked = await pool.query(
          `SELECT id, coach_id, nome FROM public.alunos WHERE ${linkCol} = $1`,
          [userIdToLink],
        );
        if (alreadyLinked.rows.length > 0) {
          const row = alreadyLinked.rows[0];
          if (req.user.role !== 'admin' && row.coach_id && String(row.coach_id) !== String(coachId)) {
            return res.status(409).json({
              error: 'Este cadastro já está vinculado a outro coach',
              error_code: 'ALREADY_LINKED_OTHER_COACH',
              aluno_id: row.id,
            });
          }
          return res.status(200).json({
            success: true,
            message: 'Cadastro já possui ficha vinculada',
            aluno: alunoRowWithCanonicalUserId({ ...row, link_user_id: userIdToLink }),
          });
        }

        let targetCoachId = coachId;
        if (req.user.role === 'admin') {
          const assign = req.body?.assignCoachId || req.body?.coach_id;
          if (!assign || !isValidCoachId(String(assign))) {
            return res.status(400).json({
              error: 'assignCoachId é obrigatório para admin ao adotar cadastro',
              error_code: 'MISSING_COACH_ID',
            });
          }
          targetCoachId = String(assign).trim();
        }

        const provisioned = await provisionAlunoForUser(pool, {
          userId: userIdToLink,
          email: userResult.rows[0].email,
          fullName,
          coachId: targetCoachId,
        });

        if (!provisioned) {
          return res.status(500).json({
            error: 'Não foi possível criar a ficha do aluno',
            error_code: 'PROVISION_FAILED',
          });
        }

        const alunoRow = await pool.query(
          `SELECT * FROM public.alunos WHERE id = $1`,
          [provisioned.alunoId],
        );

        res.status(provisioned.created ? 201 : 200).json({
          success: true,
          message: provisioned.created
            ? 'Ficha criada e cadastro vinculado com sucesso'
            : 'Cadastro vinculado à ficha existente',
          aluno: alunoRowWithCanonicalUserId(alunoRow.rows[0]),
          created: provisioned.created,
        });
      } catch (error) {
        console.error('Erro ao adotar cadastro:', error);
        res.status(500).json({
          error: 'Erro ao adotar cadastro',
          error_code: 'ADOPT_ERROR',
        });
      }
    },
  );

  router.post('/alunos/link-user', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), resolveCoachOrFail, async (req, res) => {
    try {
      const { importedAlunoId, userIdToLink } = req.body;
      const linkCol = await getAlunoUserLinkColumn(pool);

      // Validações de entrada
      if (!importedAlunoId || !userIdToLink) {
        return res.status(400).json({
          error: 'importedAlunoId e userIdToLink são obrigatórios',
          error_code: 'MISSING_PARAMETERS'
        });
      }

      // Validar UUIDs (qualquer versão RFC — não apenas v4)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(importedAlunoId) || !uuidRegex.test(userIdToLink)) {
        return res.status(400).json({
          error: 'importedAlunoId e userIdToLink devem ser UUIDs válidos',
          error_code: 'INVALID_UUID'
        });
      }

      const coachId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      // DESIGN-LINK-ALUNO-USER-001: Validação 1 - Aluno existe e pertence ao coach
      const alunoResult = await pool.query(
        `SELECT id, coach_id, ${linkCol} AS link_user_id FROM public.alunos WHERE id = $1`,
        [importedAlunoId]
      );

      if (alunoResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Aluno importado não encontrado',
          error_code: 'ALUNO_NOT_FOUND'
        });
      }

      const aluno = alunoResult.rows[0];

      // DESIGN-LINK-ALUNO-USER-001: Validação 2 - Coach autorizado (admin pode vincular qualquer aluno)
      if (!isAdmin) {
        const sessionCoachStr = String(coachId);
        const alunoCoachStr = aluno.coach_id != null ? String(aluno.coach_id) : null;
        if (alunoCoachStr !== null && alunoCoachStr !== sessionCoachStr) {
          return res.status(403).json({
            error: 'Coach não autorizado a vincular este aluno',
            error_code: 'FORBIDDEN'
          });
        }
      }

      // DESIGN-LINK-ALUNO-USER-001: Validação 3 - Aluno ainda não vinculado
      const alreadyLinked = aluno.link_user_id;
      if (alreadyLinked) {
        return res.status(409).json({
          error: 'Aluno já está vinculado a um usuário',
          error_code: 'ALUNO_ALREADY_LINKED',
          user_id: alreadyLinked
        });
      }

      // DESIGN-LINK-ALUNO-USER-001: Validação 4 - User existe
      const userResult = await pool.query(
        'SELECT id, email, email_confirmed_at FROM app_auth.users WHERE id = $1',
        [userIdToLink]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Usuário não encontrado',
          error_code: 'USER_NOT_FOUND'
        });
      }

      // Cenário 1 (opcional): exigir confirmação de email antes do vínculo.
      // Por padrão, NÃO bloquear (muitos cenários operacionais usam convites/importação antes da confirmação).
      const user = userResult.rows[0];
      const requireConfirmedEmailForLinking = process.env.REQUIRE_EMAIL_CONFIRMED_FOR_LINKING === 'true';
      if (requireConfirmedEmailForLinking && !user.email_confirmed_at) {
        return res.status(403).json({
          error: 'Confirme o seu e-mail antes de ser vinculado pelo coach.',
          error_code: 'EMAIL_NOT_CONFIRMED'
        });
      }
      if (!user.email_confirmed_at) {
        console.warn('[LINK-ALUNO-USER] Vinculando usuário sem email confirmado (permitido por configuração)', {
          user_id: userIdToLink,
          imported_aluno_id: importedAlunoId
        });
      }

      // DESIGN-LINK-ALUNO-USER-001: Validação 5 - User não está vinculado a outro aluno
      const existingLink = await pool.query(
        `SELECT id, nome FROM public.alunos WHERE ${linkCol} = $1`,
        [userIdToLink]
      );

      if (existingLink.rows.length > 0) {
        return res.status(409).json({
          error: 'Usuário já está vinculado a outro aluno',
          error_code: 'USER_ALREADY_LINKED',
          linked_aluno_id: existingLink.rows[0].id,
          linked_aluno_nome: existingLink.rows[0].nome
        });
      }

      // Atribuir coach ao aluno órfão (coach_id nulo) ao vincular; admin sem coach no registo pode enviar assignCoachId (UUID)
      const coachFallbackForOrphan = (() => {
        if (!isAdmin) {
          return coachId;
        }
        if (aluno.coach_id != null) {
          return null;
        }
        const assign = req.body?.assignCoachId;
        if (assign && uuidRegex.test(String(assign))) {
          return String(assign);
        }
        return null;
      })();

      const { emailAfterLink } = require('../utils/aluno-email-utils');
      const { resolveUserDisplayName, nomeAfterLink } = require('../utils/user-display-name');
      const alunoEmailRow = await pool.query(
        'SELECT email, nome FROM public.alunos WHERE id = $1',
        [importedAlunoId],
      );
      const resolvedEmail = emailAfterLink(alunoEmailRow.rows[0]?.email, user.email);
      const displayName = await resolveUserDisplayName(pool, userIdToLink);
      const resolvedNome = nomeAfterLink(alunoEmailRow.rows[0]?.nome, displayName);

      // DESIGN-LINK-ALUNO-USER-001: Realizar vínculo + sincronizar e-mail e nome da credencial
      const updateResult = await pool.query(
        `UPDATE public.alunos 
                 SET ${linkCol} = $1,
                     coach_id = COALESCE(coach_id, $3::uuid),
                     email = $4,
                     nome = COALESCE(NULLIF(TRIM(nome), ''), $5)
                 WHERE id = $2
                 RETURNING id, ${linkCol} AS link_user_id, coach_id, nome, email`,
        [userIdToLink, importedAlunoId, coachFallbackForOrphan, resolvedEmail, resolvedNome]
      );

      res.status(200).json({
        success: true,
        message: 'Aluno vinculado ao usuário com sucesso',
        aluno: alunoRowWithCanonicalUserId(updateResult.rows[0])
      });

    } catch (error) {
      console.error('Erro ao vincular aluno ao usuário:', error);
      res.status(500).json({
        error: 'Erro ao vincular aluno ao usuário',
        error_code: 'LINK_ERROR'
      });
    }
  });

  // GET /api/alunos/me/notification-preferences — canal in-app / email+in-app
  router.get(
    '/alunos/me/notification-preferences',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFail,
    async (req, res) => {
      try {
        const {
          getNotificationPreferences,
        } = require('../services/return-reminder.service');
        const prefs = await getNotificationPreferences(pool, req.aluno.id);
        if (!prefs) {
          return res.status(404).json({ error: 'Aluno não encontrado' });
        }
        res.json({
          notification_channel: prefs.notification_channel,
          timezone: prefs.timezone,
          labels: {
            in_app_only: 'Apenas no aplicativo (sininho)',
            in_app_and_email: 'Aplicativo e e-mail',
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  // PATCH /api/alunos/me/notification-preferences
  router.patch(
    '/alunos/me/notification-preferences',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFail,
    async (req, res) => {
      try {
        const {
          updateNotificationPreferences,
          CHANNEL_IN_APP_ONLY,
          CHANNEL_IN_APP_AND_EMAIL,
        } = require('../services/return-reminder.service');
        const { notification_channel, timezone } = req.body || {};
        const prefs = await updateNotificationPreferences(pool, req.aluno.id, {
          notification_channel,
          timezone,
        });
        res.json({
          notification_channel: prefs?.notification_channel || CHANNEL_IN_APP_AND_EMAIL,
          timezone: prefs?.timezone,
          labels: {
            in_app_only: 'Apenas no aplicativo (sininho)',
            in_app_and_email: 'Aplicativo e e-mail',
          },
        });
      } catch (error) {
        const status = error.message?.includes('inválido') ? 400 : 500;
        res.status(status).json({ error: error.message });
      }
    },
  );

  // PATCH /api/alunos/me - Atualiza dados do aluno canônico
  // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
  // DESIGN-LINK-ALUNO-USER-001: NÃO permite alterar user_id (vínculo deve ser via /api/alunos/link-user)
  router.patch('/alunos/me', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
    try {
      const aluno = req.aluno; // Já resolvido pelo middleware

      // API-CONTRACT-001: Frontend NUNCA envia aluno_id ou user_id
      // DESIGN-LINK-ALUNO-USER-001: user_id NÃO pode ser alterado via update
      const { aluno_id, user_id, coach_id, ...updateData } = req.body;

      // DESIGN-LINK-ALUNO-USER-001: Rejeitar explicitamente tentativa de alterar user_id
      if (user_id !== undefined) {
        return res.status(403).json({
          error: 'user_id não pode ser alterado via esta rota. Use POST /api/alunos/link-user para vincular.',
          error_code: 'USER_ID_UPDATE_FORBIDDEN'
        });
      }

      // Campos permitidos para atualização
      const allowedFields = ['nome', 'email', 'telefone', 'cpf_cnpj', 'data_nascimento', 'peso', 'altura', 'objetivo', 'plano', 'status'];

      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          queryParams.push(updateData[field]);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      queryParams.push(aluno.id);
      const query = `
                UPDATE public.alunos 
                SET ${updateFields.join(', ')}, updated_at = now()
                WHERE id = $${paramIndex}
                RETURNING *
            `;

      const result = await pool.query(query, queryParams);
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/alunos/by-coach - Lista alunos do coach autenticado
  // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para coaches
  router.get('/alunos/by-coach', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), resolveCoachOrFail, async (req, res) => {
    try {
      let result;
      const alunoSelectWithDisplayName = `
          SELECT a.*,
                 COALESCE(
                   NULLIF(TRIM(a.nome), ''),
                   INITCAP(REPLACE(SPLIT_PART(COALESCE(a.email, ''), '@', 1), '.', ' '))
                 ) AS nome_exibicao,
                 coach_u.email AS coach_email,
                 cp.nome_completo AS coach_nome
          FROM public.alunos a
          LEFT JOIN app_auth.users coach_u ON coach_u.id = a.coach_id
          LEFT JOIN public.coach_profiles cp ON cp.user_id = a.coach_id`;

      if (req.user.role === 'admin') {
        result = await pool.query(
          `${alunoSelectWithDisplayName}
          ORDER BY nome_exibicao ASC NULLS LAST, a.created_at DESC NULLS LAST`,
        );
      } else {
        result = await pool.query(
          `${alunoSelectWithDisplayName}
          WHERE a.coach_id = $1
          ORDER BY nome_exibicao ASC NULLS LAST, a.created_at DESC NULLS LAST`,
          [req.user.id],
        );
      }
      res.json(result.rows.map(alunoRowWithCanonicalUserId));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/alunos/:alunoId/portal-status — card estado portal no perfil do coach
  router.get(
    '/alunos/:alunoId/portal-status',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const alunoId = String(req.params.alunoId || '').trim();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(alunoId)) {
          return res.status(400).json({ error: 'alunoId inválido' });
        }

        const result = await getAlunoPortalStatus(pool, alunoId, {
          coachId: req.user.id,
          isAdmin: req.user.role === 'admin',
        });

        if (result.error === 'NOT_FOUND') {
          return res.status(404).json({ error: 'Aluno não encontrado' });
        }
        if (result.error === 'FORBIDDEN') {
          return res.status(403).json({ error: 'Sem permissão para este aluno' });
        }

        return res.json(result);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao obter estado do portal' });
      }
    },
  );

  // GET /api/alunos - Listar alunos
  router.get('/alunos', authenticate, domainSchemaGuard, async (req, res) => {
    try {
      const { coach_id, user_id, email } = req.query;
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Filtro por coach_id (coaches só veem seus próprios alunos)
      if (req.user.role === 'coach') {
        whereConditions.push(`coach_id = $${paramIndex}`);
        queryParams.push(req.user.id);
        paramIndex++;
      } else if (coach_id) {
        whereConditions.push(`coach_id = $${paramIndex}`);
        queryParams.push(coach_id);
        paramIndex++;
      }

      // Filtro por credencial (query user_id) — compatível com BD sem coluna linked_user_id
      if (user_id) {
        whereConditions.push(
          `EXISTS (SELECT 1 FROM app_auth.users u WHERE u.id = $${paramIndex} AND LOWER(TRIM(COALESCE(u.email, ''))) = LOWER(TRIM(COALESCE(a.email, ''))))`
        );
        queryParams.push(user_id);
        paramIndex++;
      }

      // Filtro por email
      if (email) {
        whereConditions.push(`email = $${paramIndex}`);
        queryParams.push(email);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const query = `
                SELECT * FROM public.alunos 
                ${whereClause}
                ORDER BY created_at DESC
            `;

      const result = await pool.query(query, queryParams);
      res.json(result.rows.map(alunoRowWithCanonicalUserId));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // API-CONTRACT-001: /api/alunos/:id é PROIBIDA
  // Use /api/alunos/me para alunos ou /api/alunos/by-coach para coaches
  // Esta rota foi removida conforme especificação

  // POST /api/alunos - Criar aluno
  router.post('/alunos', authenticate, domainSchemaGuard, async (req, res) => {
    try {
      const linkCol = await getAlunoUserLinkColumn(pool);
      const {
        nome,
        email,
        telefone,
        cpf_cnpj,
        data_nascimento,
        peso,
        objetivo,
        plano,
        user_id,
        linked_user_id: linkedUserIdBody
      } = req.body;

      // Coaches só podem criar alunos para si mesmos
      const coach_id = req.user.role === 'coach' ? req.user.id : req.body.coach_id;
      const linkUserId = linkedUserIdBody != null ? linkedUserIdBody : user_id;

      const query = `
                INSERT INTO public.alunos (
                    coach_id,
                    ${linkCol},
                    nome,
                    email,
                    telefone,
                    cpf_cnpj,
                    data_nascimento,
                    peso,
                    objetivo,
                    plano
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

      const result = await pool.query(query, [
        coach_id,
        linkUserId || null,
        nome || null,
        email || '',
        telefone || null,
        cpf_cnpj || null,
        data_nascimento || null,
        peso || null,
        objetivo || null,
        plano || null
      ]);

      res.status(201).json(alunoRowWithCanonicalUserId(result.rows[0]));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================

  // API-CONTRACT-001: PATCH /api/alunos/:id é PROIBIDA
  // Use PATCH /api/alunos/me ao invés
  // Rota removida conforme especificação

  // API-CONTRACT-001: DELETE /api/alunos/:id é PROIBIDA
  // Rota removida conforme especificação

  // API-CONTRACT-001: GET /api/alunos/:id/link-history é PROIBIDA
  // Rota removida conforme especificação

  // ============================================================================
  // ROTAS: PAYMENT_PLANS
  // ============================================================================

  // GET /api/payment-plans - Listar planos de pagamento
  router.get('/payment-plans', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), async (req, res) => {
    try {
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Coaches só veem seus próprios planos
      if (req.user.role === 'coach') {
        whereConditions.push(`coach_id = $${paramIndex}`);
        queryParams.push(req.user.id);
        paramIndex++;
      } else if (req.query.coach_id) {
        whereConditions.push(`coach_id = $${paramIndex}`);
        queryParams.push(req.query.coach_id);
        paramIndex++;
      }

      // Filtro por ativo
      if (req.query.ativo !== undefined) {
        whereConditions.push(`ativo = $${paramIndex}`);
        queryParams.push(req.query.ativo === 'true');
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const query = `
                SELECT * FROM public.payment_plans 
                ${whereClause}
                ORDER BY created_at DESC
            `;

      const result = await pool.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/payment-plans/:id - Buscar plano por ID
  router.get('/payment-plans/:id', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;

      const query = `
                SELECT * FROM public.payment_plans 
                WHERE id = $1
            `;

      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      // Verificar permissão
      if (req.user.role === 'coach' && result.rows[0].coach_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/payment-plans - Criar plano de pagamento
  router.post('/payment-plans', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), async (req, res) => {
    try {
      const {
        nome,
        descricao,
        valor,
        frequencia,
        dia_vencimento,
        ativo
      } = req.body;

      // Apenas coaches podem criar planos
      if (req.user.role !== 'coach' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas coaches podem criar planos' });
      }

      const coach_id = req.user.id;

      const query = `
                INSERT INTO public.payment_plans (
                    coach_id,
                    nome,
                    descricao,
                    valor,
                    frequencia,
                    dia_vencimento,
                    ativo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

      const result = await pool.query(query, [
        coach_id,
        nome,
        descricao || null,
        valor,
        frequencia,
        dia_vencimento,
        ativo !== undefined ? ativo : true
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/payment-plans/:id - Atualizar plano
  router.patch('/payment-plans/:id', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar permissão
      const planoCheck = await pool.query('SELECT coach_id FROM public.payment_plans WHERE id = $1', [id]);

      if (planoCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      if (req.user.role === 'coach' && planoCheck.rows[0].coach_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;

      const allowedFields = ['nome', 'descricao', 'valor', 'frequencia', 'dia_vencimento', 'ativo'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          queryParams.push(req.body[field]);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      queryParams.push(id);
      const query = `
                UPDATE public.payment_plans 
                SET ${updateFields.join(', ')}, updated_at = now()
                WHERE id = $${paramIndex}
                RETURNING *
            `;

      const result = await pool.query(query, queryParams);
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/payment-plans/:id - Deletar plano
  router.delete('/payment-plans/:id', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar permissão
      const planoCheck = await pool.query('SELECT coach_id FROM public.payment_plans WHERE id = $1', [id]);

      if (planoCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      if (req.user.role === 'coach' && planoCheck.rows[0].coach_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      await pool.query('DELETE FROM public.payment_plans WHERE id = $1', [id]);

      res.json({ message: 'Plano deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/asaas-payments — coach (seus pagamentos), admin (todos), aluno (só os seus)
  router.get(
    '/asaas-payments',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        if (req.user.role === 'admin') {
          const r = await pool.query(
            'SELECT * FROM public.asaas_payments ORDER BY created_at DESC NULLS LAST, due_date DESC'
          );
          return res.json(r.rows);
        }
        if (req.user.role === 'coach') {
          const r = await pool.query(
            'SELECT * FROM public.asaas_payments WHERE coach_id = $1 ORDER BY created_at DESC NULLS LAST, due_date DESC',
            [req.user.id]
          );
          return res.json(r.rows);
        }
        const aluno = req.aluno;
        const r = await pool.query(
          'SELECT * FROM public.asaas_payments WHERE aluno_id = $1 ORDER BY created_at DESC NULLS LAST, due_date DESC',
          [aluno.id]
        );
        return res.json(r.rows);
      } catch (error) {
        if (error.code === 'ALUNO_NOT_LINKED') {
          return res.status(403).json({
            error: 'Aluno não vinculado',
            error_code: 'ALUNO_NOT_LINKED',
          });
        }
        console.error('Erro ao listar asaas_payments:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar pagamentos' });
      }
    }
  );

  function sanitizeAsaasConfigRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      coach_id: row.coach_id,
      is_sandbox: row.is_sandbox,
      webhook_url: row.webhook_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
      has_api_key: !!(row.asaas_api_key && String(row.asaas_api_key).trim()),
    };
  }

  // GET /api/asaas-config — coach (a sua), admin (?coach_id=)
  router.get(
    '/asaas-config',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        if (req.user.role === 'admin') {
          const coachId = req.query.coach_id;
          if (coachId) {
            const r = await pool.query(
              'SELECT * FROM public.asaas_config WHERE coach_id = $1 LIMIT 1',
              [coachId],
            );
            return res.json(r.rows.map(sanitizeAsaasConfigRow).filter(Boolean));
          }
          const r = await pool.query(
            'SELECT * FROM public.asaas_config ORDER BY updated_at DESC NULLS LAST LIMIT 200',
          );
          return res.json(r.rows.map(sanitizeAsaasConfigRow));
        }
        const r = await pool.query(
          'SELECT * FROM public.asaas_config WHERE coach_id = $1 LIMIT 1',
          [req.user.id],
        );
        return res.json(r.rows.map(sanitizeAsaasConfigRow).filter(Boolean));
      } catch (error) {
        console.error('Erro ao listar asaas_config:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar configuração Asaas' });
      }
    },
  );

  router.post(
    '/asaas-config',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const { asaas_api_key, is_sandbox, webhook_url } = req.body || {};
        const key = asaas_api_key != null ? String(asaas_api_key).trim() : '';
        if (!key) {
          return res.status(400).json({
            error: 'asaas_api_key é obrigatória',
            error_code: 'MISSING_API_KEY',
          });
        }

        let coachId = req.user.id;
        if (req.user.role === 'admin') {
          if (!req.body.coach_id) {
            return res.status(400).json({
              error: 'coach_id é obrigatório para admin',
              error_code: 'MISSING_COACH_ID',
            });
          }
          coachId = req.body.coach_id;
        }

        const sandbox = is_sandbox !== undefined ? Boolean(is_sandbox) : true;
        const wh = webhook_url != null && String(webhook_url).trim() !== '' ? String(webhook_url).trim() : null;

        let storedKey;
        try {
          storedKey = encryptCoachAsaasApiKey(key);
        } catch (encErr) {
          return res.status(400).json({
            error: encErr.message || 'Não foi possível guardar a chave com segurança.',
            error_code: 'SECRET_ENCRYPTION_CONFIG',
          });
        }

        const ins = await pool.query(
          `INSERT INTO public.asaas_config (coach_id, is_sandbox, webhook_url, asaas_api_key)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (coach_id) DO UPDATE SET
             is_sandbox = EXCLUDED.is_sandbox,
             webhook_url = COALESCE(EXCLUDED.webhook_url, public.asaas_config.webhook_url),
             asaas_api_key = EXCLUDED.asaas_api_key,
             updated_at = now()
           RETURNING *`,
          [coachId, sandbox, wh, storedKey],
        );
        return res.status(201).json(sanitizeAsaasConfigRow(ins.rows[0]));
      } catch (error) {
        console.error('Erro ao gravar asaas_config:', error);
        return res.status(500).json({ error: error.message || 'Erro ao gravar configuração Asaas' });
      }
    },
  );

  router.patch(
    '/asaas-config/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT * FROM public.asaas_config WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Configuração não encontrada', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(cur.rows[0].coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }

        const allowed = new Set(['is_sandbox', 'webhook_url', 'asaas_api_key']);
        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const key of Object.keys(req.body || {})) {
          if (!allowed.has(key) || req.body[key] === undefined) continue;
          let val = req.body[key];
          if (key === 'asaas_api_key') {
            val = String(val).trim();
            if (val === '') continue;
            try {
              val = encryptCoachAsaasApiKey(val);
            } catch (encErr) {
              return res.status(400).json({
                error: encErr.message || 'Não foi possível guardar a chave com segurança.',
                error_code: 'SECRET_ENCRYPTION_CONFIG',
              });
            }
          }
          if (key === 'is_sandbox') {
            val = Boolean(val);
          }
          if (key === 'webhook_url' && val != null) {
            val = String(val).trim() || null;
          }
          updateFields.push(`${key} = $${paramIndex}`);
          queryParams.push(val);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo para atualizar', error_code: 'NO_FIELDS' });
        }

        queryParams.push(id);
        const q = `UPDATE public.asaas_config SET ${updateFields.join(', ')}, updated_at = now() WHERE id = $${paramIndex} RETURNING *`;
        const result = await pool.query(q, queryParams);
        return res.json(sanitizeAsaasConfigRow(result.rows[0]));
      } catch (error) {
        console.error('Erro ao atualizar asaas_config:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar configuração Asaas' });
      }
    },
  );

  // POST — testar chave (campo opcional usa config guardada).
  router.post(
    '/asaas-config/verify-connection',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      let apiKeyPlain = '';
      let sandbox = true;
      try {
        const body = req.body || {};

        const inlineKey =
          typeof body.asaas_api_key === 'string' ? String(body.asaas_api_key).trim() : '';
        if (inlineKey) {
          apiKeyPlain = inlineKey;
          sandbox = body.is_sandbox !== undefined ? Boolean(body.is_sandbox) : true;
        } else {
          let coachRowId = req.user.id;
          if (req.user.role === 'admin') {
            if (!body.coach_id) {
              return res.status(400).json({
                error: 'Informe coach_id ou asaas_api_key no corpo.',
                error_code: 'MISSING_COACH_OR_KEY',
              });
            }
            coachRowId = body.coach_id;
          }
          const r = await pool.query(
            'SELECT asaas_api_key, is_sandbox FROM public.asaas_config WHERE coach_id = $1 LIMIT 1',
            [coachRowId],
          );
          if (r.rows.length === 0 || !r.rows[0].asaas_api_key) {
            return res.status(400).json({
              error: 'Nenhuma chave configurada. Guarde a chave primeiro ou envie asaas_api_key no pedido.',
              error_code: 'NO_STORED_KEY',
            });
          }
          try {
            apiKeyPlain = decryptCoachAsaasApiKey(r.rows[0].asaas_api_key);
          } catch (decErr) {
            return res.status(503).json({
              error:
                decErr.message ||
                'Não foi possível ler a chave guardada. Verifique ASAAS_COACH_SECRETS_KEY no servidor.',
              error_code: 'DECRYPT_FAILED',
            });
          }
          sandbox = Boolean(r.rows[0].is_sandbox);
          if (body.is_sandbox !== undefined) sandbox = Boolean(body.is_sandbox);
        }

        if (!apiKeyPlain) {
          return res.status(400).json({ error: 'Chave API em falta', error_code: 'MISSING_API_KEY' });
        }

        const svc = new AsaasService(apiKeyPlain, sandbox ? 'sandbox' : 'production');
        const ping = await svc.verifyConnection();

        return res.json({
          ok: true,
          environment: sandbox ? 'sandbox' : 'production',
          asaas: { object: ping.object, totalCount: ping.totalCount },
        });
      } catch (error) {
        const msg = error.message || 'Falha ao validar conexão com Asaas';
        const normalizedMsg = String(msg).toLowerCase();

        // Erro comum: chave válida, mas usada no ambiente errado (sandbox/prod).
        const looksLikeEnvironmentMismatch =
          normalizedMsg.includes('não pertence a este ambiente') ||
          normalizedMsg.includes('nao pertence a este ambiente') ||
          normalizedMsg.includes('does not belong to this environment');

        if (looksLikeEnvironmentMismatch && apiKeyPlain) {
          const suggestedSandbox = !sandbox;
          try {
            const retrySvc = new AsaasService(
              apiKeyPlain,
              suggestedSandbox ? 'sandbox' : 'production',
            );
            await retrySvc.verifyConnection();
            return res.status(409).json({
              ok: false,
              error:
                'A chave de API está correta, mas pertence ao outro ambiente do Asaas. Altere o modo e teste novamente.',
              error_code: 'ASAAS_ENV_MISMATCH',
              current_environment: sandbox ? 'sandbox' : 'production',
              suggested_environment: suggestedSandbox ? 'sandbox' : 'production',
            });
          } catch {
            // segue para tratamento padrão abaixo
          }
        }

        const status =
          error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 502;
        return res.status(status).json({
          ok: false,
          error: msg,
          error_code: 'ASAAS_VERIFY_FAILED',
        });
      }
    },
  );

  function sanitizeTwilioConfigRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      coach_id: row.coach_id,
      account_sid: row.account_sid,
      // Nunca devolver auth_token em texto para o frontend.
      auth_token: null,
      has_auth_token: !!(row.auth_token && String(row.auth_token).trim()),
      whatsapp_from: row.whatsapp_from,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // GET /api/twilio-config — coach (a sua), admin (?coach_id=)
  router.get(
    '/twilio-config',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        if (req.user.role === 'admin') {
          const coachId = req.query.coach_id;
          if (coachId) {
            const r = await pool.query(
              'SELECT * FROM public.twilio_config WHERE coach_id = $1 LIMIT 1',
              [coachId],
            );
            return res.json(r.rows.map(sanitizeTwilioConfigRow).filter(Boolean));
          }
          const r = await pool.query(
            'SELECT * FROM public.twilio_config ORDER BY updated_at DESC NULLS LAST LIMIT 200',
          );
          return res.json(r.rows.map(sanitizeTwilioConfigRow));
        }
        const r = await pool.query(
          'SELECT * FROM public.twilio_config WHERE coach_id = $1 LIMIT 1',
          [req.user.id],
        );
        return res.json(r.rows.map(sanitizeTwilioConfigRow).filter(Boolean));
      } catch (error) {
        console.error('Erro ao listar twilio_config:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar configuração Twilio' });
      }
    },
  );

  router.post(
    '/twilio-config',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const body = req.body || {};
        let coachId = req.user.id;
        if (req.user.role === 'admin') {
          if (!body.coach_id) {
            return res.status(400).json({
              error: 'coach_id é obrigatório para admin',
              error_code: 'MISSING_COACH_ID',
            });
          }
          coachId = body.coach_id;
        }

        const accountSid =
          body.account_sid != null && String(body.account_sid).trim() !== ''
            ? String(body.account_sid).trim()
            : null;
        const authToken =
          body.auth_token != null && String(body.auth_token).trim() !== ''
            ? String(body.auth_token).trim()
            : null;
        const whatsappFrom =
          body.whatsapp_from != null && String(body.whatsapp_from).trim() !== ''
            ? String(body.whatsapp_from).trim()
            : null;

        if (!accountSid || !authToken || !whatsappFrom) {
          return res.status(400).json({
            error: 'account_sid, auth_token e whatsapp_from são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }

        const cur = await pool.query(
          'SELECT id FROM public.twilio_config WHERE coach_id = $1 LIMIT 1',
          [coachId],
        );
        if (cur.rows.length > 0) {
          const upd = await pool.query(
            `UPDATE public.twilio_config
             SET account_sid = $1, auth_token = $2, whatsapp_from = $3, updated_at = now()
             WHERE id = $4
             RETURNING *`,
            [accountSid, authToken, whatsappFrom, cur.rows[0].id],
          );
          return res.status(200).json(sanitizeTwilioConfigRow(upd.rows[0]));
        }

        const ins = await pool.query(
          `INSERT INTO public.twilio_config (coach_id, account_sid, auth_token, whatsapp_from)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [coachId, accountSid, authToken, whatsappFrom],
        );
        return res.status(201).json(sanitizeTwilioConfigRow(ins.rows[0]));
      } catch (error) {
        console.error('Erro ao gravar twilio_config:', error);
        return res.status(500).json({ error: error.message || 'Erro ao gravar configuração Twilio' });
      }
    },
  );

  router.patch(
    '/twilio-config/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT * FROM public.twilio_config WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Configuração não encontrada', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(cur.rows[0].coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }

        const allowed = new Set(['account_sid', 'auth_token', 'whatsapp_from']);
        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const key of Object.keys(req.body || {})) {
          if (!allowed.has(key) || req.body[key] === undefined) continue;
          const val = String(req.body[key] ?? '').trim();
          if (!val) continue;
          updateFields.push(`${key} = $${paramIndex}`);
          queryParams.push(val);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo para atualizar', error_code: 'NO_FIELDS' });
        }

        queryParams.push(id);
        const q = `UPDATE public.twilio_config SET ${updateFields.join(', ')}, updated_at = now() WHERE id = $${paramIndex} RETURNING *`;
        const result = await pool.query(q, queryParams);
        return res.json(sanitizeTwilioConfigRow(result.rows[0]));
      } catch (error) {
        console.error('Erro ao atualizar twilio_config:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar configuração Twilio' });
      }
    },
  );

  // ============================================================================
  // ROTAS: EXCEÇÕES FINANCEIRAS (financial_exceptions)
  // ============================================================================

  router.get(
    '/financial-exceptions',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        if (req.user.role === 'admin') {
          const r = await pool.query(
            'SELECT * FROM public.financial_exceptions ORDER BY created_at DESC NULLS LAST'
          );
          return res.json(r.rows);
        }
        if (req.user.role === 'coach') {
          const r = await pool.query(
            'SELECT * FROM public.financial_exceptions WHERE coach_id = $1 ORDER BY created_at DESC NULLS LAST',
            [req.user.id]
          );
          return res.json(r.rows);
        }
        const aluno = req.aluno;
        const r = await pool.query(
          'SELECT * FROM public.financial_exceptions WHERE aluno_id = $1 ORDER BY created_at DESC NULLS LAST',
          [aluno.id]
        );
        return res.json(r.rows);
      } catch (error) {
        if (error.code === 'ALUNO_NOT_LINKED') {
          return res.status(403).json({ error: 'Aluno não vinculado', error_code: 'ALUNO_NOT_LINKED' });
        }
        console.error('Erro ao listar financial_exceptions:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar exceções' });
      }
    }
  );

  const FINANCIAL_EXCEPTION_TIPOS = new Set(['isento', 'desconto', 'acordo_pagamento', 'bolsa']);

  router.post(
    '/financial-exceptions',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const {
          aluno_id,
          motivo,
          tipo,
          valor_desconto,
          percentual_desconto,
          data_inicio,
          data_fim,
          observacoes,
          ativo,
        } = req.body;

        if (!aluno_id || !motivo || !tipo || !data_inicio) {
          return res.status(400).json({
            error: 'aluno_id, motivo, tipo e data_inicio são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }
        if (!FINANCIAL_EXCEPTION_TIPOS.has(tipo)) {
          return res.status(400).json({ error: 'tipo inválido', error_code: 'INVALID_TIPO' });
        }

        let coachId = req.user.id;
        if (req.user.role === 'admin') {
          if (!req.body.coach_id) {
            return res.status(400).json({ error: 'coach_id é obrigatório para admin', error_code: 'MISSING_COACH_ID' });
          }
          coachId = req.body.coach_id;
        }

        const own = await pool.query('SELECT id FROM public.alunos WHERE id = $1 AND coach_id = $2', [
          aluno_id,
          coachId,
        ]);
        if (own.rows.length === 0) {
          return res.status(403).json({
            error: 'Aluno não encontrado ou não pertence a este coach',
            error_code: 'ALUNO_NOT_BELONGS_TO_COACH',
          });
        }

        const ins = await pool.query(
          `INSERT INTO public.financial_exceptions (
            coach_id, aluno_id, motivo, tipo, valor_desconto, percentual_desconto,
            data_inicio, data_fim, observacoes, ativo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, true))
          RETURNING *`,
          [
            coachId,
            aluno_id,
            String(motivo).trim(),
            tipo,
            valor_desconto != null ? valor_desconto : null,
            percentual_desconto != null ? percentual_desconto : null,
            data_inicio,
            data_fim || null,
            observacoes != null ? String(observacoes) : null,
            ativo !== false,
          ]
        );
        return res.status(201).json(ins.rows[0]);
      } catch (error) {
        console.error('Erro ao criar financial_exception:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar exceção' });
      }
    }
  );

  router.patch(
    '/financial-exceptions/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT * FROM public.financial_exceptions WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Exceção não encontrada', error_code: 'NOT_FOUND' });
        }
        const row = cur.rows[0];
        if (req.user.role === 'coach' && String(row.coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }

        const allowed = new Set([
          'motivo',
          'tipo',
          'valor_desconto',
          'percentual_desconto',
          'data_inicio',
          'data_fim',
          'observacoes',
          'ativo',
        ]);
        const updates = {};
        for (const [k, v] of Object.entries(req.body || {})) {
          if (allowed.has(k)) {
            if (k === 'tipo' && v != null && !FINANCIAL_EXCEPTION_TIPOS.has(String(v))) {
              return res.status(400).json({ error: 'tipo inválido', error_code: 'INVALID_TIPO' });
            }
            updates[k] = v;
          }
        }
        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'Nenhum campo válido', error_code: 'NO_FIELDS' });
        }

        const keys = Object.keys(updates);
        const vals = Object.values(updates);
        const setClause = keys.map((col, i) => `${col} = $${i + 1}`).join(', ');
        const r = await pool.query(
          `UPDATE public.financial_exceptions SET ${setClause}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
          [...vals, id]
        );
        return res.json(r.rows[0]);
      } catch (error) {
        console.error('Erro ao atualizar financial_exception:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar exceção' });
      }
    }
  );

  router.delete(
    '/financial-exceptions/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT coach_id FROM public.financial_exceptions WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Exceção não encontrada', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(cur.rows[0].coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        await pool.query('DELETE FROM public.financial_exceptions WHERE id = $1', [id]);
        return res.json({ ok: true });
      } catch (error) {
        console.error('Erro ao apagar financial_exception:', error);
        return res.status(500).json({ error: error.message || 'Erro ao apagar exceção' });
      }
    }
  );

  // ============================================================================
  // ROTAS: DESPESAS (expenses)
  // ============================================================================

  const EXPENSE_STATUS = new Set(['pendente', 'pago', 'atrasado', 'cancelado']);
  const EXPENSE_FREQ = new Set(['mensal', 'trimestral', 'semestral', 'anual']);

  router.get(
    '/expenses',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        if (req.user.role === 'admin') {
          const r = await pool.query(
            'SELECT * FROM public.expenses ORDER BY data_vencimento DESC NULLS LAST, created_at DESC'
          );
          return res.json(r.rows);
        }
        const r = await pool.query(
          'SELECT * FROM public.expenses WHERE coach_id = $1 ORDER BY data_vencimento DESC NULLS LAST, created_at DESC',
          [req.user.id]
        );
        return res.json(r.rows);
      } catch (error) {
        console.error('Erro ao listar expenses:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar despesas' });
      }
    }
  );

  router.post(
    '/expenses',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const {
          descricao,
          valor,
          categoria,
          data_vencimento,
          data_pagamento,
          status,
          forma_pagamento,
          observacoes,
          recorrente,
          frequencia_recorrencia,
        } = req.body;

        if (!descricao || valor == null || !categoria || !data_vencimento) {
          return res.status(400).json({
            error: 'descricao, valor, categoria e data_vencimento são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }
        const st = status || 'pendente';
        if (!EXPENSE_STATUS.has(st)) {
          return res.status(400).json({ error: 'status inválido', error_code: 'INVALID_STATUS' });
        }

        let coachId = req.user.id;
        if (req.user.role === 'admin') {
          if (!req.body.coach_id) {
            return res.status(400).json({ error: 'coach_id é obrigatório para admin', error_code: 'MISSING_COACH_ID' });
          }
          coachId = req.body.coach_id;
        }

        const rec = Boolean(recorrente);
        let freq = frequencia_recorrencia || null;
        if (rec && freq && !EXPENSE_FREQ.has(String(freq))) {
          return res.status(400).json({ error: 'frequencia_recorrencia inválida', error_code: 'INVALID_FREQ' });
        }
        if (!rec) {
          freq = null;
        }

        const ins = await pool.query(
          `INSERT INTO public.expenses (
            coach_id, descricao, valor, categoria, data_vencimento, data_pagamento,
            status, forma_pagamento, observacoes, recorrente, frequencia_recorrencia
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            coachId,
            String(descricao).trim(),
            valor,
            String(categoria).trim(),
            data_vencimento,
            data_pagamento || null,
            st,
            forma_pagamento != null ? String(forma_pagamento) : null,
            observacoes != null ? String(observacoes) : null,
            rec,
            freq,
          ]
        );
        return res.status(201).json(ins.rows[0]);
      } catch (error) {
        console.error('Erro ao criar expense:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar despesa' });
      }
    }
  );

  router.patch(
    '/expenses/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT coach_id FROM public.expenses WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Despesa não encontrada', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(cur.rows[0].coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }

        const allowed = new Set([
          'descricao',
          'valor',
          'categoria',
          'data_vencimento',
          'data_pagamento',
          'status',
          'forma_pagamento',
          'observacoes',
          'recorrente',
          'frequencia_recorrencia',
        ]);
        const updates = {};
        for (const [k, v] of Object.entries(req.body || {})) {
          if (!allowed.has(k)) continue;
          if (k === 'status' && v != null && !EXPENSE_STATUS.has(String(v))) {
            return res.status(400).json({ error: 'status inválido', error_code: 'INVALID_STATUS' });
          }
          if (k === 'frequencia_recorrencia' && v != null && !EXPENSE_FREQ.has(String(v))) {
            return res.status(400).json({ error: 'frequencia_recorrencia inválida', error_code: 'INVALID_FREQ' });
          }
          updates[k] = v;
        }
        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'Nenhum campo válido', error_code: 'NO_FIELDS' });
        }

        const keys = Object.keys(updates);
        const vals = Object.values(updates);
        const setClause = keys.map((col, i) => `${col} = $${i + 1}`).join(', ');
        const r = await pool.query(
          `UPDATE public.expenses SET ${setClause}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
          [...vals, id]
        );
        return res.json(r.rows[0]);
      } catch (error) {
        console.error('Erro ao atualizar expense:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar despesa' });
      }
    }
  );

  router.delete(
    '/expenses/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT coach_id FROM public.expenses WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Despesa não encontrada', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(cur.rows[0].coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        await pool.query('DELETE FROM public.expenses WHERE id = $1', [id]);
        return res.json({ ok: true });
      } catch (error) {
        console.error('Erro ao apagar expense:', error);
        return res.status(500).json({ error: error.message || 'Erro ao apagar despesa' });
      }
    }
  );

  // ============================================================================
  // ROTAS: AGENDA EVENTOS (public.agenda_eventos)
  // ============================================================================

  const {
    onAgendaEventSaved,
    newCycleId: newAgendaReminderCycleId,
    getAgendaSummary,
    getAgendaAttention,
    getCoachNotificationPreferences,
    updateCoachNotificationPreferences,
  } = require('../services/agenda-coach-reminder.service');

  const {
    resolveCoachScope,
    listTeamMembers,
    addTeamMember,
    removeTeamMember,
    assertCoachCanAccessAluno,
  } = require('../services/coach-team.service');
  const {
    getAgendaSuggestions,
    snoozeAgendaEvent,
  } = require('../services/agenda-crm.service');

  async function attachCoachScope(req, res, next) {
    try {
      req.coachScope = await resolveCoachScope(pool, req.user.id, req.user.role);
      next();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  function effectiveCoachIds(scope) {
    if (scope.isAdmin && scope.coachIds === null) return null;
    return scope.coachIds;
  }

  const AGENDA_TIPO = new Set([
    'retorno', 'ajuste_dieta', 'alteracao_treino', 'avaliacao', 'outro',
    'consulta', 'acompanhamento',
  ]);
  const AGENDA_STATUS = new Set(['pendente', 'concluido', 'cancelado']);
  const AGENDA_PRIORIDADE = new Set(['baixa', 'normal', 'alta']);

  router.get(
    '/agenda-eventos/suggestions',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    async (req, res) => {
      try {
        const ids = effectiveCoachIds(req.coachScope);
        if (!ids) {
          return res.json([]);
        }
        const rows = await getAgendaSuggestions(pool, ids);
        return res.json(rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro nas sugestões' });
      }
    },
  );

  router.get(
    '/agenda-eventos/summary',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    async (req, res) => {
      try {
        let coachIds = effectiveCoachIds(req.coachScope);
        if (req.user.role === 'admin' && req.query.coach_id) {
          coachIds = [req.query.coach_id];
        }
        if (!coachIds) {
          return res.json({
            pendentes_hoje: 0,
            pendentes_amanha: 0,
            atrasados: 0,
            proximos_7_dias: 0,
            por_tipo: {},
          });
        }
        const summary = await getAgendaSummary(pool, coachIds);
        return res.json(summary);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao resumir agenda' });
      }
    },
  );

  router.get(
    '/agenda-eventos/attention',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    async (req, res) => {
      try {
        let coachIds = effectiveCoachIds(req.coachScope);
        if (req.user.role === 'admin' && req.query.coach_id) {
          coachIds = [req.query.coach_id];
        }
        if (!coachIds) {
          return res.json([]);
        }
        const limit = Math.min(parseInt(req.query.limit, 10) || 15, 50);
        const rows = await getAgendaAttention(pool, coachIds, limit);
        return res.json(rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao listar atenção' });
      }
    },
  );

  router.get(
    '/coach/me/notification-preferences',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const prefs = await getCoachNotificationPreferences(pool, req.user.id);
        return res.json({
          ...prefs,
          labels: {
            in_app_only: 'Apenas no aplicativo (sininho)',
            in_app_and_email: 'Aplicativo e e-mail',
          },
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  );

  router.patch(
    '/coach/me/notification-preferences',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const { notification_channel, timezone } = req.body || {};
        const prefs = await updateCoachNotificationPreferences(pool, req.user.id, {
          notification_channel,
          timezone,
        });
        return res.json({
          ...prefs,
          labels: {
            in_app_only: 'Apenas no aplicativo (sininho)',
            in_app_and_email: 'Aplicativo e e-mail',
          },
        });
      } catch (error) {
        const status = error.message?.includes('inválido') ? 400 : 500;
        return res.status(status).json({ error: error.message });
      }
    },
  );

  router.get(
    '/agenda-eventos',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant', 'aluno']),
    requireAlunoWhenStudent(),
    attachCoachScope,
    async (req, res) => {
      try {
        if (req.user.role === 'admin' && !req.coachScope?.coachIds) {
          const r = await pool.query(
            `SELECT ae.*, a.ultimo_contato_em, a.ultimo_contato_resumo
             FROM public.agenda_eventos ae
             LEFT JOIN public.alunos a ON a.id = ae.aluno_id
             ORDER BY ae.data_evento ASC, ae.hora_evento ASC NULLS LAST, ae.created_at DESC LIMIT 500`,
          );
          return res.json(r.rows);
        }
        if (req.user.role === 'coach' || req.user.role === 'assistant') {
          const ids = effectiveCoachIds(req.coachScope) || [req.user.id];
          const r = await pool.query(
            `SELECT ae.*, a.ultimo_contato_em, a.ultimo_contato_resumo
             FROM public.agenda_eventos ae
             LEFT JOIN public.alunos a ON a.id = ae.aluno_id
             WHERE ae.coach_id = ANY($1::uuid[])
             ORDER BY ae.data_evento ASC, ae.hora_evento ASC NULLS LAST, ae.created_at DESC`,
            [ids],
          );
          return res.json(r.rows);
        }
        const r = await pool.query(
          `SELECT * FROM public.agenda_eventos WHERE aluno_id = $1 ORDER BY data_evento ASC, hora_evento ASC NULLS LAST, created_at DESC`,
          [req.aluno.id],
        );
        return res.json(r.rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao listar agenda' });
      }
    },
  );

  router.post(
    '/agenda-eventos/:id/snooze',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    validateUUIDParam('id'),
    attachCoachScope,
    async (req, res) => {
      try {
        if (!req.coachScope.canWrite) {
          return res.status(403).json({ error: 'Sem permissão para adiar lembretes', error_code: 'FORBIDDEN' });
        }
        const days = req.body?.days ?? 1;
        const row = await snoozeAgendaEvent(pool, req.params.id, req.coachScope, days);
        if (!row) {
          return res.status(404).json({ error: 'Evento não encontrado', error_code: 'NOT_FOUND' });
        }
        return res.json(row);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  );

  router.post(
    '/agenda-eventos',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    async (req, res) => {
      try {
        const {
          titulo,
          descricao,
          data_evento,
          hora_evento,
          tipo,
          status,
          prioridade,
          aluno_id,
          notificacao_enviada,
        } = req.body;

        if (!titulo || !data_evento || !tipo) {
          return res.status(400).json({
            error: 'titulo, data_evento e tipo são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }
        const tipoNorm = String(tipo);
        if (!AGENDA_TIPO.has(tipoNorm)) {
          return res.status(400).json({ error: 'tipo inválido', error_code: 'INVALID_TIPO' });
        }
        const st = status != null ? String(status) : 'pendente';
        if (!AGENDA_STATUS.has(st)) {
          return res.status(400).json({ error: 'status inválido', error_code: 'INVALID_STATUS' });
        }
        const pr = prioridade != null ? String(prioridade) : 'normal';
        if (!AGENDA_PRIORIDADE.has(pr)) {
          return res.status(400).json({ error: 'prioridade inválida', error_code: 'INVALID_PRIORIDADE' });
        }

        if (!req.coachScope.canWrite) {
          return res.status(403).json({ error: 'Sem permissão de escrita na Agenda', error_code: 'FORBIDDEN' });
        }

        let coachId = req.coachScope.ownerCoachId || req.user.id;
        if (req.user.role === 'admin') {
          if (!req.body.coach_id) {
            return res.status(400).json({ error: 'coach_id é obrigatório para admin', error_code: 'MISSING_COACH_ID' });
          }
          coachId = req.body.coach_id;
        }

        if (aluno_id) {
          const own = await pool.query(
            `SELECT id FROM public.alunos WHERE id = $1 AND coach_id = $2`,
            [aluno_id, coachId],
          );
          if (own.rows.length === 0) {
            return res.status(400).json({
              error: 'aluno_id inválido ou não pertence ao coach',
              error_code: 'INVALID_ALUNO',
            });
          }
        }

        const cycleId = newAgendaReminderCycleId();
        const ins = await pool.query(
          `INSERT INTO public.agenda_eventos (
            coach_id, aluno_id, titulo, descricao, data_evento, hora_evento,
            tipo, status, prioridade, notificacao_enviada, reminder_cycle_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            coachId,
            aluno_id || null,
            String(titulo).trim(),
            descricao != null ? String(descricao) : null,
            data_evento,
            hora_evento || null,
            tipoNorm,
            st,
            pr,
            Boolean(notificacao_enviada),
            cycleId,
          ],
        );
        let row = ins.rows[0];
        try {
          row = await onAgendaEventSaved(pool, row, { previous: null });
        } catch (hookErr) {
          console.warn('agenda.on_create_hook_failed', hookErr.message);
        }
        return res.status(201).json(row);
      } catch (error) {
        console.error('Erro ao criar agenda_evento:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar evento' });
      }
    },
  );

  router.patch(
    '/agenda-eventos/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    validateUUIDParam('id'),
    attachCoachScope,
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT * FROM public.agenda_eventos WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Evento não encontrado', error_code: 'NOT_FOUND' });
        }
        const previous = cur.rows[0];
        const ids = effectiveCoachIds(req.coachScope);
        if (ids && !ids.includes(String(previous.coach_id))) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        if (!req.coachScope.canWrite) {
          return res.status(403).json({ error: 'Sem permissão de escrita', error_code: 'FORBIDDEN' });
        }

        const allowed = new Set([
          'snoozed_until',
          'titulo',
          'descricao',
          'data_evento',
          'hora_evento',
          'tipo',
          'status',
          'prioridade',
          'notificacao_enviada',
          'aluno_id',
        ]);
        if (req.user.role === 'admin') {
          allowed.add('coach_id');
        }

        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const key of Object.keys(req.body || {})) {
          if (!allowed.has(key) || req.body[key] === undefined) continue;
          let val = req.body[key];
          if (key === 'tipo' && !AGENDA_TIPO.has(String(val))) {
            return res.status(400).json({ error: 'tipo inválido', error_code: 'INVALID_TIPO' });
          }
          if (key === 'status' && !AGENDA_STATUS.has(String(val))) {
            return res.status(400).json({ error: 'status inválido', error_code: 'INVALID_STATUS' });
          }
          if (key === 'prioridade' && !AGENDA_PRIORIDADE.has(String(val))) {
            return res.status(400).json({ error: 'prioridade inválida', error_code: 'INVALID_PRIORIDADE' });
          }
          if (key === 'notificacao_enviada') {
            val = Boolean(val);
          }
          if (key === 'aluno_id' && val != null) {
            const cid = previous.coach_id;
            const own = await pool.query(`SELECT id FROM public.alunos WHERE id = $1 AND coach_id = $2`, [val, cid]);
            if (own.rows.length === 0) {
              return res.status(400).json({
                error: 'aluno_id inválido ou não pertence ao coach do evento',
                error_code: 'INVALID_ALUNO',
              });
            }
          }
          if (key === 'coach_id' && req.user.role === 'admin') {
            updateFields.push(`${key} = $${paramIndex}`);
            queryParams.push(val);
            paramIndex++;
            continue;
          }
          if (key === 'coach_id') continue;

          updateFields.push(`${key} = $${paramIndex}`);
          queryParams.push(val);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo para atualizar', error_code: 'NO_FIELDS' });
        }

        queryParams.push(id);
        const q = `UPDATE public.agenda_eventos SET ${updateFields.join(', ')}, updated_at = now() WHERE id = $${paramIndex} RETURNING *`;
        const result = await pool.query(q, queryParams);
        let row = result.rows[0];
        try {
          row = await onAgendaEventSaved(pool, row, { previous });
        } catch (hookErr) {
          console.warn('agenda.on_patch_hook_failed', hookErr.message);
        }
        return res.json(row);
      } catch (error) {
        console.error('Erro ao atualizar agenda_evento:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar evento' });
      }
    },
  );

  router.get(
    '/coach/team/members',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    attachCoachScope,
    async (req, res) => {
      try {
        const ownerId = req.coachScope.isAssistant
          ? req.coachScope.ownerCoachId
          : req.user.id;
        const rows = await listTeamMembers(pool, ownerId);
        return res.json(rows);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  );

  router.post(
    '/coach/team/members',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    attachCoachScope,
    async (req, res) => {
      try {
        if (req.coachScope.isAssistant) {
          return res.status(403).json({ error: 'Apenas o coach titular gere a equipa', error_code: 'FORBIDDEN' });
        }
        const row = await addTeamMember(pool, req.user.id, {
          member_email: req.body?.member_email,
          team_role: req.body?.team_role || 'assistant',
        });
        return res.status(201).json(row);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    },
  );

  router.delete(
    '/coach/team/members/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    attachCoachScope,
    async (req, res) => {
      try {
        if (req.coachScope.isAssistant) {
          return res.status(403).json({ error: 'Apenas o coach titular gere a equipa', error_code: 'FORBIDDEN' });
        }
        const row = await removeTeamMember(pool, req.user.id, req.params.id);
        if (!row) {
          return res.status(404).json({ error: 'Membro não encontrado' });
        }
        return res.json({ ok: true });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  );

  router.delete(
    '/agenda-eventos/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    validateUUIDParam('id'),
    attachCoachScope,
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT coach_id FROM public.agenda_eventos WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Evento não encontrado', error_code: 'NOT_FOUND' });
        }
        const ids = effectiveCoachIds(req.coachScope);
        if (ids && !ids.includes(String(cur.rows[0].coach_id))) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        if (!req.coachScope.canWrite) {
          return res.status(403).json({ error: 'Sem permissão de escrita', error_code: 'FORBIDDEN' });
        }
        await pool.query('DELETE FROM public.agenda_eventos WHERE id = $1', [id]);
        return res.json({ ok: true });
      } catch (error) {
        console.error('Erro ao apagar agenda_evento:', error);
        return res.status(500).json({ error: error.message || 'Erro ao apagar evento' });
      }
    },
  );

  // ============================================================================
  // ROTAS: EVENTOS DE TURMA / CALENDÁRIO (public.eventos + eventos_participantes)
  // Usado pelo EventsCalendar; distinto de agenda_eventos (retornos, etc.).
  // ============================================================================

  router.get(
    '/eventos',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    async (req, res) => {
      try {
        if (req.user.role === 'admin') {
          const r = await pool.query(
            `SELECT * FROM public.eventos ORDER BY data_inicio ASC, hora_inicio ASC NULLS LAST, created_at DESC LIMIT 500`,
          );
          return res.json(r.rows);
        }
        if (req.user.role === 'coach') {
          const r = await pool.query(
            `SELECT * FROM public.eventos WHERE coach_id = $1 ORDER BY data_inicio ASC, hora_inicio ASC NULLS LAST, created_at DESC`,
            [req.user.id],
          );
          return res.json(r.rows);
        }
        const aluno = await getAlunoRowForAuthUser(req.user.id);
        if (!aluno) {
          return res.json([]);
        }
        const r = await pool.query(
          `SELECT DISTINCT e.* FROM public.eventos e
           INNER JOIN public.eventos_participantes ep ON ep.evento_id = e.id
           WHERE ep.aluno_id = $1
           ORDER BY e.data_inicio ASC, e.hora_inicio ASC NULLS LAST`,
          [aluno.id],
        );
        return res.json(r.rows);
      } catch (error) {
        console.error('Erro ao listar eventos:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar eventos' });
      }
    },
  );

  router.post(
    '/eventos',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const {
          titulo,
          descricao,
          data_inicio,
          hora_inicio,
          duracao_minutos,
          recorrencia,
          link_online,
          turma_id,
        } = req.body;

        if (!titulo || !data_inicio || !hora_inicio) {
          return res.status(400).json({
            error: 'titulo, data_inicio e hora_inicio são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }

        let coachId = req.user.id;
        if (req.user.role === 'admin') {
          if (!req.body.coach_id) {
            return res.status(400).json({ error: 'coach_id é obrigatório para admin', error_code: 'MISSING_COACH_ID' });
          }
          coachId = req.body.coach_id;
        } else if (req.body.coach_id && String(req.body.coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'coach_id inválido', error_code: 'FORBIDDEN' });
        }

        let turmaId = turma_id || null;
        if (turmaId) {
          const tr = await pool.query(`SELECT coach_id FROM public.turmas WHERE id = $1`, [turmaId]);
          if (tr.rows.length === 0) {
            return res.status(400).json({ error: 'turma_id inválido', error_code: 'INVALID_TURMA' });
          }
          if (String(tr.rows[0].coach_id) !== String(coachId)) {
            return res.status(403).json({ error: 'Turma não pertence ao coach', error_code: 'FORBIDDEN' });
          }
        }

        const dur = duracao_minutos != null ? parseInt(String(duracao_minutos), 10) : 60;
        const rec = recorrencia != null ? String(recorrencia) : 'unica';

        const ins = await pool.query(
          `INSERT INTO public.eventos (
            coach_id, turma_id, titulo, descricao, data_inicio, hora_inicio,
            duracao_minutos, recorrencia, link_online
          ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::time, $7, $8, $9)
          RETURNING *`,
          [
            coachId,
            turmaId,
            String(titulo).trim(),
            descricao != null ? String(descricao) : null,
            data_inicio,
            hora_inicio,
            Number.isFinite(dur) && dur > 0 ? dur : 60,
            rec,
            link_online != null && String(link_online).trim() !== '' ? String(link_online).trim() : null,
          ],
        );
        return res.status(201).json(ins.rows[0]);
      } catch (error) {
        console.error('Erro ao criar evento:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar evento' });
      }
    },
  );

  router.patch(
    '/eventos/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cur = await pool.query('SELECT coach_id FROM public.eventos WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'Evento não encontrado', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(cur.rows[0].coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }

        const allowed = new Set([
          'titulo',
          'descricao',
          'data_inicio',
          'hora_inicio',
          'duracao_minutos',
          'recorrencia',
          'recorrencia_config',
          'link_online',
          'turma_id',
          'status',
        ]);
        if (req.user.role === 'admin') {
          allowed.add('coach_id');
        }

        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const key of Object.keys(req.body || {})) {
          if (!allowed.has(key) || req.body[key] === undefined) continue;
          if (key === 'coach_id' && req.user.role !== 'admin') continue;

          if (key === 'turma_id') {
            const val = req.body[key];
            if (val != null) {
              const tr = await pool.query(`SELECT coach_id FROM public.turmas WHERE id = $1`, [val]);
              if (tr.rows.length === 0) {
                return res.status(400).json({ error: 'turma_id inválido', error_code: 'INVALID_TURMA' });
              }
              const cid = cur.rows[0].coach_id;
              if (String(tr.rows[0].coach_id) !== String(cid)) {
                return res.status(403).json({ error: 'Turma não pertence ao coach do evento', error_code: 'FORBIDDEN' });
              }
            }
          }

          const val = req.body[key];
          if (key === 'data_inicio') {
            updateFields.push(`${key} = $${paramIndex}::timestamptz`);
          } else if (key === 'hora_inicio') {
            updateFields.push(`${key} = $${paramIndex}::time`);
          } else if (key === 'recorrencia_config') {
            updateFields.push(`${key} = $${paramIndex}::jsonb`);
          } else {
            updateFields.push(`${key} = $${paramIndex}`);
          }
          queryParams.push(val);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo para atualizar', error_code: 'NO_FIELDS' });
        }

        queryParams.push(id);
        const q = `UPDATE public.eventos SET ${updateFields.join(', ')}, updated_at = now() WHERE id = $${paramIndex} RETURNING *`;
        const result = await pool.query(q, queryParams);
        return res.json(result.rows[0]);
      } catch (error) {
        console.error('Erro ao atualizar evento:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar evento' });
      }
    },
  );

  router.get(
    '/eventos-participantes',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    async (req, res) => {
      try {
        const eventoId = req.query.evento_id;
        if (req.user.role === 'admin') {
          let q = `SELECT ep.* FROM public.eventos_participantes ep`;
          const params = [];
          if (eventoId) {
            q += ` WHERE ep.evento_id = $1`;
            params.push(eventoId);
          }
          q += ` ORDER BY ep.created_at DESC LIMIT 2000`;
          const r = await pool.query(q, params);
          return res.json(r.rows);
        }
        if (req.user.role === 'coach') {
          let q = `SELECT ep.* FROM public.eventos_participantes ep
            INNER JOIN public.eventos e ON e.id = ep.evento_id
            WHERE e.coach_id = $1`;
          const params = [req.user.id];
          if (eventoId) {
            q += ` AND ep.evento_id = $2`;
            params.push(eventoId);
          }
          q += ` ORDER BY ep.created_at DESC LIMIT 2000`;
          const r = await pool.query(q, params);
          return res.json(r.rows);
        }
        const aluno = await getAlunoRowForAuthUser(req.user.id);
        if (!aluno) {
          return res.json([]);
        }
        let q = `SELECT ep.* FROM public.eventos_participantes ep WHERE ep.aluno_id = $1`;
        const params = [aluno.id];
        if (eventoId) {
          q += ` AND ep.evento_id = $2`;
          params.push(eventoId);
        }
        q += ` ORDER BY ep.created_at DESC`;
        const r = await pool.query(q, params);
        return res.json(r.rows);
      } catch (error) {
        console.error('Erro ao listar eventos_participantes:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar participantes' });
      }
    },
  );

  router.post(
    '/eventos-participantes',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const rows = Array.isArray(req.body) ? req.body : [];
        if (rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Corpo deve ser um array não vazio', error_code: 'INVALID_BODY' });
        }

        const inserted = [];
        for (const row of rows) {
          const evId = row.evento_id;
          const alunoId = row.aluno_id;
          if (!evId || !alunoId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'cada item precisa de evento_id e aluno_id', error_code: 'MISSING_FIELDS' });
          }

          const ev = await client.query('SELECT coach_id FROM public.eventos WHERE id = $1', [evId]);
          if (ev.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'evento_id inválido', error_code: 'INVALID_EVENTO' });
          }
          const coachId = ev.rows[0].coach_id;
          if (req.user.role === 'coach' && String(coachId) !== String(req.user.id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Acesso negado ao evento', error_code: 'FORBIDDEN' });
          }

          const al = await client.query('SELECT coach_id FROM public.alunos WHERE id = $1', [alunoId]);
          if (al.rows.length === 0 || String(al.rows[0].coach_id) !== String(coachId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'aluno_id inválido para este evento', error_code: 'INVALID_ALUNO' });
          }

          const ins = await client.query(
            `INSERT INTO public.eventos_participantes (evento_id, aluno_id) VALUES ($1, $2) RETURNING *`,
            [evId, alunoId],
          );
          inserted.push(ins.rows[0]);
        }
        await client.query('COMMIT');
        return res.status(201).json(inserted);
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {
          /* ignore */
        }
        console.error('Erro ao criar eventos_participantes:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar participantes' });
      } finally {
        client.release();
      }
    },
  );

  // ============================================================================
  // ROTAS: RELATÓRIOS (public.relatorios + feedbacks + mídias)
  // ============================================================================

  const RELATORIO_STATUS = new Set(['rascunho', 'enviado', 'visualizado']);

  async function fetchRelatorioById(pool, id) {
    const r = await pool.query('SELECT * FROM public.relatorios WHERE id = $1', [id]);
    return r.rows[0] || null;
  }

  async function userCanAccessRelatorio(req, rel) {
    if (!rel) return false;
    if (req.user.role === 'admin') return true;
    if (req.user.role === 'coach') return String(rel.coach_id) === String(req.user.id);
    if (req.user.role === 'aluno') {
      const row = await getAlunoRowForAuthUser(req.user.id);
      return !!row && String(rel.aluno_id) === String(row.id);
    }
    return false;
  }

  router.get(
    '/relatorios',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        if (req.user.role === 'admin') {
          const r = await pool.query(
            `SELECT * FROM public.relatorios ORDER BY created_at DESC LIMIT 2000`,
          );
          return res.json(r.rows);
        }
        if (req.user.role === 'coach') {
          const r = await pool.query(
            `SELECT * FROM public.relatorios WHERE coach_id = $1 ORDER BY created_at DESC`,
            [req.user.id],
          );
          return res.json(r.rows);
        }
        const r = await pool.query(`SELECT * FROM public.relatorios WHERE aluno_id = $1 ORDER BY created_at DESC`, [
          req.aluno.id,
        ]);
        return res.json(r.rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao listar relatórios' });
      }
    },
  );

  router.get(
    '/relatorios/:id',
    authenticate,
    domainSchemaGuard,
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const rel = await fetchRelatorioById(pool, req.params.id);
        if (!rel) {
          return res.status(404).json({ error: 'Relatório não encontrado', error_code: 'NOT_FOUND' });
        }
        if (!(await userCanAccessRelatorio(req, rel))) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        return res.json(rel);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao buscar relatório' });
      }
    },
  );

  router.post(
    '/relatorios',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const {
          titulo,
          aluno_id,
          periodo_inicio,
          periodo_fim,
          observacoes,
          template_id,
          dados,
          metricas,
        } = req.body;

        if (!titulo || !aluno_id || !periodo_inicio || !periodo_fim) {
          return res.status(400).json({
            error: 'titulo, aluno_id, periodo_inicio e periodo_fim são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }

        let coachId = req.user.id;
        if (req.user.role === 'admin') {
          if (!req.body.coach_id) {
            return res.status(400).json({ error: 'coach_id é obrigatório para admin', error_code: 'MISSING_COACH_ID' });
          }
          coachId = req.body.coach_id;
        }

        const own = await pool.query(`SELECT id FROM public.alunos WHERE id = $1 AND coach_id = $2`, [
          aluno_id,
          coachId,
        ]);
        if (own.rows.length === 0) {
          return res.status(400).json({
            error: 'aluno_id inválido ou não pertence ao coach',
            error_code: 'INVALID_ALUNO',
          });
        }

        const ins = await pool.query(
          `INSERT INTO public.relatorios (
            coach_id, aluno_id, template_id, titulo, periodo_inicio, periodo_fim,
            dados, observacoes, metricas, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, 'rascunho')
          RETURNING *`,
          [
            coachId,
            aluno_id,
            template_id || null,
            String(titulo).trim(),
            periodo_inicio,
            periodo_fim,
            dados != null ? JSON.stringify(dados) : '{}',
            observacoes != null ? String(observacoes) : null,
            metricas != null ? JSON.stringify(metricas) : '{}',
          ],
        );
        return res.status(201).json(ins.rows[0]);
      } catch (error) {
        console.error('Erro ao criar relatório:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar relatório' });
      }
    },
  );

  router.patch(
    '/relatorios/:id',
    authenticate,
    domainSchemaGuard,
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const rel = await fetchRelatorioById(pool, id);
        if (!rel) {
          return res.status(404).json({ error: 'Relatório não encontrado', error_code: 'NOT_FOUND' });
        }

        if (req.user.role === 'aluno') {
          if (!(await userCanAccessRelatorio(req, rel))) {
            return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
          }
          const keys = Object.keys(req.body || {});
          const bad = keys.filter((k) => !['status', 'visualizado_em'].includes(k));
          if (bad.length > 0) {
            return res.status(403).json({ error: 'Aluno só pode atualizar status e visualizado_em', error_code: 'FORBIDDEN' });
          }
          if (req.body.status !== undefined && !RELATORIO_STATUS.has(String(req.body.status))) {
            return res.status(400).json({ error: 'status inválido', error_code: 'INVALID_STATUS' });
          }
        } else if (req.user.role === 'coach') {
          if (String(rel.coach_id) !== String(req.user.id)) {
            return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
          }
        } else if (req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }

        const coachIdForAlunoCheck = rel.coach_id;
        const allowedCoach = new Set([
          'titulo',
          'aluno_id',
          'periodo_inicio',
          'periodo_fim',
          'observacoes',
          'template_id',
          'dados',
          'metricas',
          'status',
          'enviado_em',
          'visualizado_em',
        ]);
        const allowedAluno = new Set(['status', 'visualizado_em']);
        const allowed = req.user.role === 'aluno' ? allowedAluno : allowedCoach;

        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        for (const key of Object.keys(req.body || {})) {
          if (!allowed.has(key) || req.body[key] === undefined) continue;
          if (key === 'status' && !RELATORIO_STATUS.has(String(req.body[key]))) {
            return res.status(400).json({ error: 'status inválido', error_code: 'INVALID_STATUS' });
          }
          if (key === 'aluno_id' && req.user.role !== 'aluno') {
            const own = await pool.query(`SELECT id FROM public.alunos WHERE id = $1 AND coach_id = $2`, [
              req.body[key],
              coachIdForAlunoCheck,
            ]);
            if (own.rows.length === 0) {
              return res.status(400).json({
                error: 'aluno_id inválido ou não pertence ao coach do relatório',
                error_code: 'INVALID_ALUNO',
              });
            }
          }
          let val = req.body[key];
          if (key === 'dados' || key === 'metricas') {
            val = JSON.stringify(val);
            updateFields.push(`${key} = $${paramIndex}::jsonb`);
          } else {
            updateFields.push(`${key} = $${paramIndex}`);
          }
          queryParams.push(val);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'Nenhum campo para atualizar', error_code: 'NO_FIELDS' });
        }

        queryParams.push(id);
        const q = `UPDATE public.relatorios SET ${updateFields.join(', ')}, updated_at = now() WHERE id = $${paramIndex} RETURNING *`;
        const result = await pool.query(q, queryParams);
        return res.json(result.rows[0]);
      } catch (error) {
        console.error('Erro ao atualizar relatório:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar relatório' });
      }
    },
  );

  router.delete(
    '/relatorios/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const rel = await fetchRelatorioById(pool, id);
        if (!rel) {
          return res.status(404).json({ error: 'Relatório não encontrado', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(rel.coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        await pool.query('DELETE FROM public.relatorio_midias WHERE relatorio_id = $1', [id]);
        await pool.query('DELETE FROM public.relatorio_feedbacks WHERE relatorio_id = $1', [id]);
        await pool.query('DELETE FROM public.relatorios WHERE id = $1', [id]);
        return res.json({ ok: true });
      } catch (error) {
        console.error('Erro ao apagar relatório:', error);
        return res.status(500).json({ error: error.message || 'Erro ao apagar relatório' });
      }
    },
  );

  router.get(
    '/relatorio-feedbacks',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        const rid = req.query.relatorio_id;
        if (!rid || !isValidUUID(rid)) {
          return res.status(400).json({ error: 'relatorio_id (UUID) é obrigatório', error_code: 'MISSING_RELATORIO_ID' });
        }
        const rel = await fetchRelatorioById(pool, rid);
        if (!rel) {
          return res.status(404).json({ error: 'Relatório não encontrado', error_code: 'NOT_FOUND' });
        }
        if (!(await userCanAccessRelatorio(req, rel))) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        const r = await pool.query(
          `SELECT * FROM public.relatorio_feedbacks WHERE relatorio_id = $1 ORDER BY created_at DESC`,
          [rid],
        );
        return res.json(r.rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao listar feedbacks' });
      }
    },
  );

  router.post(
    '/relatorio-feedbacks',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFail,
    async (req, res) => {
      try {
        const { relatorio_id, aluno_id, comentario } = req.body || {};
        if (!relatorio_id || !isValidUUID(relatorio_id) || !comentario || String(comentario).trim() === '') {
          return res.status(400).json({
            error: 'relatorio_id e comentario são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }
        if (String(aluno_id) !== String(req.aluno.id)) {
          return res.status(403).json({ error: 'aluno_id inconsistente', error_code: 'FORBIDDEN' });
        }
        const rel = await fetchRelatorioById(pool, relatorio_id);
        if (!rel || String(rel.aluno_id) !== String(req.aluno.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        const ins = await pool.query(
          `INSERT INTO public.relatorio_feedbacks (relatorio_id, aluno_id, comentario) VALUES ($1, $2, $3) RETURNING *`,
          [relatorio_id, req.aluno.id, String(comentario).trim()],
        );
        return res.status(201).json(ins.rows[0]);
      } catch (error) {
        console.error('Erro ao criar feedback:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar feedback' });
      }
    },
  );

  router.get(
    '/relatorio-midias',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        const rid = req.query.relatorio_id;
        if (!rid || !isValidUUID(rid)) {
          return res.status(400).json({ error: 'relatorio_id (UUID) é obrigatório', error_code: 'MISSING_RELATORIO_ID' });
        }
        const rel = await fetchRelatorioById(pool, rid);
        if (!rel) {
          return res.status(404).json({ error: 'Relatório não encontrado', error_code: 'NOT_FOUND' });
        }
        if (!(await userCanAccessRelatorio(req, rel))) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        const r = await pool.query(
          `SELECT * FROM public.relatorio_midias WHERE relatorio_id = $1 ORDER BY ordem ASC NULLS LAST, created_at ASC`,
          [rid],
        );
        return res.json(r.rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao listar mídias' });
      }
    },
  );

  router.post(
    '/relatorio-midias',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const { relatorio_id, tipo, url, legenda, ordem } = req.body || {};
        if (!relatorio_id || !isValidUUID(relatorio_id) || !tipo || !url) {
          return res.status(400).json({
            error: 'relatorio_id, tipo e url são obrigatórios',
            error_code: 'MISSING_FIELDS',
          });
        }
        const t = String(tipo);
        if (t !== 'foto' && t !== 'video') {
          return res.status(400).json({ error: 'tipo deve ser foto ou video', error_code: 'INVALID_TIPO' });
        }
        const rel = await fetchRelatorioById(pool, relatorio_id);
        if (!rel) {
          return res.status(404).json({ error: 'Relatório não encontrado', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(rel.coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        const ins = await pool.query(
          `INSERT INTO public.relatorio_midias (relatorio_id, tipo, url, legenda, ordem) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [relatorio_id, t, String(url), legenda != null ? String(legenda) : null, ordem != null ? Number(ordem) : 0],
        );
        return res.status(201).json(ins.rows[0]);
      } catch (error) {
        console.error('Erro ao criar mídia:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar mídia' });
      }
    },
  );

  router.delete(
    '/relatorio-midias',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const rid = req.query.relatorio_id;
        if (!rid || !isValidUUID(rid)) {
          return res.status(400).json({ error: 'relatorio_id (UUID) é obrigatório', error_code: 'MISSING_RELATORIO_ID' });
        }
        const rel = await fetchRelatorioById(pool, rid);
        if (!rel) {
          return res.status(404).json({ error: 'Relatório não encontrado', error_code: 'NOT_FOUND' });
        }
        if (req.user.role === 'coach' && String(rel.coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        await pool.query('DELETE FROM public.relatorio_midias WHERE relatorio_id = $1', [rid]);
        return res.json({ ok: true });
      } catch (error) {
        console.error('Erro ao apagar mídias:', error);
        return res.status(500).json({ error: error.message || 'Erro ao apagar mídias' });
      }
    },
  );

  // ============================================================================
  // ROTAS: NOTIFICAÇÕES
  // ============================================================================

  // GET /api/notificacoes/:id - Buscar notificação por ID
  router.get('/notificacoes/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;

      const query = `
                SELECT * FROM public.notificacoes 
                WHERE id = $1
            `;

      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      // Verificar permissão
      const notificacao = result.rows[0];
      if (req.user.role === 'coach' && String(notificacao.coach_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      if (req.user.role === 'aluno') {
        if (!notificacao.aluno_id) {
          return res.status(403).json({ error: 'Acesso negado' });
        }
        const alunoRow = await getAlunoRowForAuthUser(req.user.id);
        if (!alunoRow || String(alunoRow.id) !== String(notificacao.aluno_id)) {
          return res.status(403).json({
            error: 'Acesso negado',
            error_code: !alunoRow ? 'ALUNO_NOT_LINKED' : undefined,
          });
        }
      }

      res.json(notificacao);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/notificacoes - Criar notificação
  router.post('/notificacoes', authenticate, domainSchemaGuard, async (req, res) => {
    try {
      const {
        aluno_id,
        titulo,
        mensagem,
        tipo,
        link
      } = req.body;

      // Apenas coaches podem criar notificações
      if (req.user.role !== 'coach' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas coaches podem criar notificações' });
      }

      const coach_id = req.user.id;

      const query = `
                INSERT INTO public.notificacoes (
                    coach_id,
                    aluno_id,
                    titulo,
                    mensagem,
                    tipo,
                    link
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

      const result = await pool.query(query, [
        coach_id,
        aluno_id || null,
        titulo,
        mensagem,
        tipo || 'info',
        link || null
      ]);

      const created = result.rows[0];

      if (aluno_id) {
        try {
          const { getAuthUserIdForAluno } = require('../utils/aluno-auth-user');
          const { sendStudentNotificationEmail } = require('../utils/send-student-notification-email');
          const studentUserId = await getAuthUserIdForAluno(pool, aluno_id);
          if (studentUserId) {
            const emailRow = await pool.query(
              'SELECT email FROM app_auth.users WHERE id = $1 LIMIT 1',
              [studentUserId],
            );
            const nomeRow = await pool.query(
              'SELECT nome FROM public.alunos WHERE id = $1 LIMIT 1',
              [aluno_id],
            );
            const emailType = ['aviso', 'novo_evento', 'evento_cancelado', 'event_reminder'].includes(
              String(tipo || ''),
            )
              ? String(tipo)
              : 'aviso';
            const linkTab =
              link && String(link).trim() && !String(link).includes('/')
                ? String(link).trim()
                : link && String(link).includes('tab=')
                  ? String(link).split('tab=')[1]?.split('&')[0] || 'messages'
                  : 'messages';

            await sendStudentNotificationEmail({
              to: emailRow.rows[0]?.email,
              type: emailType,
              context: {
                title: titulo,
                message: mensagem,
                linkTab,
                alunoNome: nomeRow.rows[0]?.nome,
                eventTitle: titulo,
              },
            });
          }
        } catch (mailErr) {
          console.warn('notificacoes.create.email_failed', {
            aluno_id,
            tipo,
            error: mailErr.message,
          });
        }
      }

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/notificacoes/:id - Atualizar notificação
  router.patch('/notificacoes/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar permissão
      const notificacaoCheck = await pool.query(
        'SELECT coach_id, aluno_id FROM public.notificacoes WHERE id = $1',
        [id]
      );

      if (notificacaoCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      const notificacao = notificacaoCheck.rows[0];

      // Coaches podem atualizar suas próprias notificações
      // Alunos podem apenas marcar como lida
      if (req.user.role === 'coach' && String(notificacao.coach_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      if (req.user.role === 'aluno') {
        // Alunos só podem atualizar o campo 'lida'
        if (Object.keys(req.body).length > 1 || req.body.lida === undefined) {
          return res.status(403).json({ error: 'Alunos só podem marcar notificações como lida' });
        }

        const alunoRow = await getAlunoRowForAuthUser(req.user.id);
        if (!alunoRow || String(alunoRow.id) !== String(notificacao.aluno_id)) {
          return res.status(403).json({
            error: 'Acesso negado',
            error_code: !alunoRow ? 'ALUNO_NOT_LINKED' : undefined,
          });
        }
      }

      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;

      const allowedFields = req.user.role === 'aluno'
        ? ['lida']
        : ['titulo', 'mensagem', 'tipo', 'link', 'lida'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          queryParams.push(req.body[field]);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      queryParams.push(id);
      const query = `
                UPDATE public.notificacoes 
                SET ${updateFields.join(', ')}, updated_at = now()
                WHERE id = $${paramIndex}
                RETURNING *
            `;

      const result = await pool.query(query, queryParams);
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/notificacoes/:id - Deletar notificação
  router.delete('/notificacoes/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar permissão
      const notificacaoCheck = await pool.query(
        'SELECT coach_id FROM public.notificacoes WHERE id = $1',
        [id]
      );

      if (notificacaoCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      // Apenas coaches podem deletar notificações
      if (req.user.role !== 'coach' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas coaches podem deletar notificações' });
      }

      if (req.user.role === 'coach' && String(notificacaoCheck.rows[0].coach_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      await pool.query('DELETE FROM public.notificacoes WHERE id = $1', [id]);

      res.json({ message: 'Notificação deletada com sucesso' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // ENDPOINTS REST CANÔNICOS - BLACKHOUSE-BACKEND-SOVEREIGN-ARCH-004
  // ============================================================================
  // Endpoints REST clássicos (sem padrões PostgREST)
  // Nunca usar select=, eq=, order= nas URLs
  // ============================================================================

  // GET /api/notificacoes - Notificações do usuário autenticado
  router.get('/notificacoes', authenticate, domainSchemaGuard, async (req, res) => {
    try {
      const { lida, tipo, limit } = req.query;

      let query;
      let queryParams = [];
      let paramIndex = 1;

      if (req.user.role === 'admin') {
        query = 'SELECT * FROM public.notificacoes WHERE 1=1';
        queryParams = [];
        paramIndex = 1;
      } else if (req.user.role === 'coach') {
        query = `SELECT * FROM public.notificacoes
                 WHERE coach_id = $1
                   AND NOT (tipo = 'checkin_reminder' AND titulo = 'Check-in semanal')`;
        queryParams.push(req.user.id);
        paramIndex++;
      } else if (req.user.role === 'aluno') {
        const alunoRow = await getAlunoRowForAuthUser(req.user.id);
        if (!alunoRow) {
          return res.json([]);
        }
        query = `SELECT * FROM public.notificacoes
                 WHERE aluno_id = $1
                   AND tipo NOT IN ('new_weekly_checkin')
                   AND NOT (tipo = 'checkin_reminder' AND titulo = 'Lembrete de Check-in')`;
        queryParams.push(alunoRow.id);
        paramIndex++;
      } else {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Filtros opcionais
      if (lida !== undefined) {
        query += ` AND lida = $${paramIndex}`;
        queryParams.push(lida === 'true');
        paramIndex++;
      }

      if (tipo) {
        query += ` AND tipo = $${paramIndex}`;
        queryParams.push(tipo);
        paramIndex++;
      }

      query += ' ORDER BY created_at DESC';

      if (limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(parseInt(limit));
      }

      const result = await pool.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // ROTAS: USER ROLES (admin — apenas coach)
  // ============================================================================

  router.get(
    '/user-roles',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const result = await pool.query(`
          SELECT id, user_id, role, created_at
          FROM public.user_roles
          ORDER BY created_at DESC NULLS LAST
        `);
        res.json(result.rows);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  router.patch(
    '/user-roles/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { role } = req.body || {};
        if (role !== 'coach' && role !== 'aluno' && role !== 'admin') {
          return res.status(400).json({
            error: 'role deve ser "coach", "aluno" ou "admin"',
            error_code: 'INVALID_ROLE',
          });
        }

        const existing = await pool.query(
          'SELECT id, user_id, role FROM public.user_roles WHERE id = $1',
          [req.params.id],
        );
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: 'Role não encontrada', error_code: 'ROLE_NOT_FOUND' });
        }

        if (existing.rows[0].role === 'admin' && role !== 'admin' && req.user.role !== 'admin') {
          return res.status(403).json({
            error: 'Apenas super admin pode alterar papel de outro admin',
            error_code: 'FORBIDDEN',
          });
        }

        if (existing.rows[0].role === 'coach' && role !== 'coach') {
          const coachCount = await pool.query(
            `SELECT COUNT(*)::int AS n FROM public.user_roles WHERE role = 'coach'`,
          );
          if (coachCount.rows[0].n <= 1) {
            return res.status(400).json({
              error: 'Não é possível alterar o papel do último coach do sistema.',
              error_code: 'LAST_COACH',
            });
          }
        }

        const result = await pool.query(
          `UPDATE public.user_roles SET role = $1::user_role WHERE id = $2 RETURNING id, user_id, role, created_at`,
          [role, req.params.id],
        );
        res.json(result.rows[0]);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  router.delete(
    '/user-roles/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    resolveCoachOrFail,
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const out = await deleteUserByUserRoleId(pool, req.params.id);
        if (!out.ok) {
          return res.status(out.status).json(out.body);
        }
        res.json(out.body);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  // GET /api/profiles/me - Perfil do usuário logado
  router.get('/profiles/me', authenticate, async (req, res) => {
    try {
      const userId = req.user.id;

      const query = `
                SELECT 
                    p.id,
                    p.avatar_url,
                    p.display_name,
                    p.phone,
                    p.created_at,
                    p.updated_at,
                    u.email,
                    u.created_at as user_created_at,
                    COALESCE(ur.role, 'aluno') as role
                FROM public.profiles p
                RIGHT JOIN app_auth.users u ON u.id = p.id
                LEFT JOIN public.user_roles ur ON ur.user_id = u.id
                WHERE u.id = $1
            `;

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Perfil não encontrado' });
      }

      // Se for aluno, incluir dados do aluno
      if (req.user.role === 'aluno') {
        try {
          const aluno = await fetchAlunoByUserId(pool, userId);
          result.rows[0].aluno = aluno;
        } catch (error) {
          if (error.code === 'ALUNO_NOT_LINKED') {
            // Aluno não vinculado - retornar perfil sem aluno
            result.rows[0].aluno = null;
            result.rows[0].aluno_linked = false;
          } else {
            throw error;
          }
        }
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/profiles/me — atualiza perfil do utilizador autenticado (avatar, nome, telefone)
  router.patch('/profiles/me', authenticate, async (req, res) => {
    try {
      const userId = req.user.id;
      const body = req.body && typeof req.body === 'object' ? req.body : {};

      const prev = await pool.query(
        `SELECT avatar_url, display_name, phone FROM public.profiles WHERE id = $1`,
        [userId],
      );
      const row = prev.rows[0] || {};

      const hasKey = (k) => Object.prototype.hasOwnProperty.call(body, k);

      let nextAvatar = row.avatar_url ?? null;
      if (hasKey('avatar_url')) {
        const v = body.avatar_url;
        nextAvatar = v == null || String(v).trim() === '' ? null : String(v).trim();
      }

      let nextDisplay = row.display_name ?? null;
      if (hasKey('display_name')) {
        const v = body.display_name;
        nextDisplay = v == null || String(v).trim() === '' ? null : String(v).trim();
      }

      let nextPhone = row.phone ?? null;
      if (hasKey('phone')) {
        const v = body.phone;
        nextPhone = v == null || String(v).trim() === '' ? null : String(v).trim();
      }

      await pool.query(
        `INSERT INTO public.profiles (id, avatar_url, display_name, phone, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id)
         DO UPDATE SET
           avatar_url = EXCLUDED.avatar_url,
           display_name = EXCLUDED.display_name,
           phone = EXCLUDED.phone,
           updated_at = now()`,
        [userId, nextAvatar, nextDisplay, nextPhone],
      );

      const out = await pool.query(
        `SELECT 
            p.id,
            p.avatar_url,
            p.display_name,
            p.phone,
            p.created_at,
            p.updated_at,
            u.email,
            u.created_at as user_created_at,
            COALESCE(ur.role, 'aluno') as role
         FROM public.profiles p
         RIGHT JOIN app_auth.users u ON u.id = p.id
         LEFT JOIN public.user_roles ur ON ur.user_id = u.id
         WHERE u.id = $1`,
        [userId],
      );

      if (out.rows.length === 0) {
        return res.status(404).json({ error: 'Perfil não encontrado' });
      }

      if (req.user.role === 'aluno') {
        try {
          const aluno = await fetchAlunoByUserId(pool, userId);
          out.rows[0].aluno = aluno;
        } catch (error) {
          if (error.code === 'ALUNO_NOT_LINKED') {
            out.rows[0].aluno = null;
            out.rows[0].aluno_linked = false;
          } else {
            throw error;
          }
        }
      }

      return res.json(out.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/profiles — lista perfis (avatar) para painel admin do coach
  router.get(
    '/profiles',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach']),
    resolveCoachOrFail,
    async (req, res) => {
      try {
        const result = await pool.query(
          `SELECT id, avatar_url, created_at, updated_at FROM public.profiles ORDER BY created_at DESC`,
        );
        res.json(result.rows);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  // ============================================================================
  // ROTA: /api/me - Buscar identidade do usuário/aluno atual
  // ============================================================================
  // DESIGN-VPS-ONLY-DATA-AND-STORAGE-002
  // Frontend deve usar este endpoint para buscar identidade do aluno
  // ============================================================================

  router.get('/me', authenticate, async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Buscar dados do usuário
      const userResult = await pool.query(
        'SELECT id, email, created_at FROM app_auth.users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const userData = {
        ...userResult.rows[0],
        role: userRole,
        payment_status: req.user.payment_status || 'CURRENT'
      };

      // Se for aluno, buscar dados do aluno também
      // VPS-NATIVE-ARCH-ALUNOS-COACH-001: Usar resolveAlunoOrFail para garantir aluno canônico
      if (userRole === 'aluno') {
        try {
          const aluno = await fetchAlunoByUserId(pool, userId);
          userData.aluno = aluno;
        } catch (error) {
          if (error.code === 'ALUNO_NOT_LINKED') {
            // Aluno não vinculado - retornar erro explícito
            userData.aluno = null;
            userData.aluno_linked = false;
          } else {
            throw error;
          }
        }
      }

      res.json(userData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // ROTA: /api/fotos-alunos — fotos de progresso (sem /rest/v1/fotos_alunos)
  // ============================================================================

  router.get(
    '/fotos-alunos',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno', 'coach', 'admin']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        const alunoId = req.query.aluno_id;
        if (!alunoId || !isValidUUID(String(alunoId))) {
          return res.status(400).json({
            error: 'aluno_id é obrigatório e deve ser um UUID válido',
            error_code: 'INVALID_ALUNO_ID',
          });
        }

        if (req.user.role === 'admin') {
          const r = await pool.query(
            `SELECT f.id, f.aluno_id, a.coach_id, f.url, f.descricao, f.created_at
             FROM public.fotos_alunos f
             LEFT JOIN public.alunos a ON a.id = f.aluno_id
             WHERE f.aluno_id = $1
             ORDER BY f.created_at DESC NULLS LAST`,
            [alunoId],
          );
          return res.json(r.rows);
        }

        if (req.user.role === 'coach') {
          const ok = await validateAlunoBelongsToCoach(pool, alunoId, req.user.id);
          if (!ok) {
            return res.status(403).json({ error: 'Sem permissão para este aluno', error_code: 'FORBIDDEN' });
          }
          const r = await pool.query(
            `SELECT f.id, f.aluno_id, a.coach_id, f.url, f.descricao, f.created_at
             FROM public.fotos_alunos f
             LEFT JOIN public.alunos a ON a.id = f.aluno_id
             WHERE f.aluno_id = $1
             ORDER BY f.created_at DESC NULLS LAST`,
            [alunoId],
          );
          return res.json(r.rows);
        }

        if (req.aluno.id !== alunoId) {
          return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
        }
        const r = await pool.query(
          `SELECT f.id, f.aluno_id, a.coach_id, f.url, f.descricao, f.created_at
           FROM public.fotos_alunos f
           LEFT JOIN public.alunos a ON a.id = f.aluno_id
           WHERE f.aluno_id = $1
           ORDER BY f.created_at DESC NULLS LAST`,
          [alunoId],
        );
        return res.json(r.rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao listar fotos' });
      }
    },
  );

  router.post(
    '/fotos-alunos',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFail,
    async (req, res) => {
      return res.status(403).json({
        error:
          'As fotos de evolução devem ser enviadas no check-in semanal (aba Check-in).',
        error_code: 'CHECKIN_PHOTOS_ONLY_VIA_WEEKLY',
      });
    },
  );

  router.delete(
    '/fotos-alunos/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    resolveAlunoOrFail,
    async (req, res) => {
      try {
        const fotoId = req.params.id;
        if (!isValidUUID(String(fotoId))) {
          return res.status(400).json({ error: 'ID inválido', error_code: 'INVALID_UUID' });
        }
        const sel = await pool.query(
          `SELECT id, aluno_id FROM public.fotos_alunos WHERE id = $1`,
          [fotoId],
        );
        if (sel.rows.length === 0) {
          return res.status(404).json({ error: 'Foto não encontrada', error_code: 'NOT_FOUND' });
        }
        if (sel.rows[0].aluno_id !== req.aluno.id) {
          return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
        }
        await pool.query(`DELETE FROM public.fotos_alunos WHERE id = $1`, [fotoId]);
        return res.json({ message: 'Deletado com sucesso' });
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao eliminar foto' });
      }
    },
  );

  // ============================================================================
  // ROTAS: FEEDBACKS DE CHECK-IN (feedbacks_alunos)
  // ============================================================================

  router.get(
    '/feedbacks-alunos',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno', 'coach', 'admin']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        let alunoId = req.query.aluno_id;

        if (req.user.role === 'aluno') {
          const aluno = req.aluno;
          if (!aluno) {
            return res.status(403).json({
              error: 'Aluno não vinculado',
              error_code: 'ALUNO_NOT_LINKED',
            });
          }
          alunoId = aluno.id;
        } else if (!alunoId) {
          return res.status(400).json({
            error: 'aluno_id é obrigatório',
            error_code: 'MISSING_ALUNO_ID',
          });
        }

        if (req.user.role === 'coach') {
          const allowed = await validateAlunoBelongsToCoach(pool, alunoId, req.user.id);
          if (!allowed) {
            return res.status(403).json({
              error: 'Aluno não pertence a este coach',
              error_code: 'FORBIDDEN',
            });
          }
        }

        const result = await pool.query(
          `SELECT id, aluno_id, coach_id, feedback, created_at, updated_at
           FROM public.feedbacks_alunos
           WHERE aluno_id = $1
           ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
          [alunoId],
        );
        return res.json(result.rows);
      } catch (error) {
        console.error('Erro ao listar feedbacks de aluno:', error);
        return res.status(500).json({ error: error.message || 'Erro ao listar feedbacks' });
      }
    },
  );

  router.post(
    '/feedbacks-alunos',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const { aluno_id: alunoIdBody, feedback } = req.body || {};
        if (!alunoIdBody) {
          return res.status(400).json({ error: 'aluno_id é obrigatório', error_code: 'MISSING_ALUNO_ID' });
        }
        if (!feedback || !String(feedback).trim()) {
          return res.status(400).json({ error: 'feedback é obrigatório', error_code: 'MISSING_FEEDBACK' });
        }

        const alunoRes = await pool.query('SELECT id, coach_id FROM public.alunos WHERE id = $1', [alunoIdBody]);
        if (alunoRes.rows.length === 0) {
          return res.status(404).json({ error: 'Aluno não encontrado', error_code: 'ALUNO_NOT_FOUND' });
        }
        const alunoRow = alunoRes.rows[0];
        const coachId = req.user.role === 'admin' ? alunoRow.coach_id : req.user.id;
        if (!coachId) {
          return res.status(400).json({ error: 'Aluno sem coach vinculado', error_code: 'COACH_NOT_FOUND' });
        }
        if (req.user.role === 'coach') {
          const allowed = await validateAlunoBelongsToCoach(pool, alunoIdBody, req.user.id);
          if (!allowed) {
            return res.status(403).json({ error: 'Aluno não pertence a este coach', error_code: 'FORBIDDEN' });
          }
        }

        const ins = await pool.query(
          `INSERT INTO public.feedbacks_alunos (aluno_id, coach_id, feedback)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [alunoIdBody, coachId, String(feedback).trim()],
        );
        return res.status(201).json(ins.rows[0]);
      } catch (error) {
        console.error('Erro ao criar feedback de aluno:', error);
        return res.status(500).json({ error: error.message || 'Erro ao criar feedback' });
      }
    },
  );

  router.patch(
    '/feedbacks-alunos/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { feedback } = req.body || {};
        if (!feedback || !String(feedback).trim()) {
          return res.status(400).json({ error: 'feedback é obrigatório', error_code: 'MISSING_FEEDBACK' });
        }

        const existing = await pool.query('SELECT * FROM public.feedbacks_alunos WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: 'Feedback não encontrado', error_code: 'NOT_FOUND' });
        }
        const row = existing.rows[0];

        if (req.user.role === 'coach' && String(row.coach_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
        }

        const upd = await pool.query(
          `UPDATE public.feedbacks_alunos SET feedback = $1, updated_at = now() WHERE id = $2 RETURNING *`,
          [String(feedback).trim(), id],
        );
        return res.json(upd.rows[0]);
      } catch (error) {
        console.error('Erro ao atualizar feedback de aluno:', error);
        return res.status(500).json({ error: error.message || 'Erro ao atualizar feedback' });
      }
    },
  );

  // ============================================================================
  // ROTA: /api/weekly-checkins — listagem (alias semântico para o dashboard)
  // ============================================================================

  const { trendsSummary: checkinTrendsSummary, draftResponse: checkinDraftResponse } = require('../services/checkin-ai.service');

  router.post(
    '/weekly-checkins/ai/trends-summary',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    async (req, res) => {
      try {
        const alunoId = req.body?.aluno_id;
        if (!alunoId) {
          return res.status(400).json({ error: 'aluno_id é obrigatório', error_code: 'VALIDATION' });
        }
        const data = await checkinTrendsSummary(pool, req.coachScope, alunoId);
        return res.json(data);
      } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
          error: error.message || 'Erro ao gerar resumo',
          error_code: error.error_code,
        });
      }
    },
  );

  router.post(
    '/weekly-checkins/:id/ai/draft-response',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const data = await checkinDraftResponse(
          pool,
          req.coachScope,
          req.params.id,
          req.body?.hints || '',
        );
        return res.json(data);
      } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
          error: error.message || 'Erro ao gerar rascunho',
          error_code: error.error_code,
        });
      }
    },
  );

  router.get(
    '/weekly-checkins/pendentes/count',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    async (req, res) => {
      try {
        const dbCols = await loadWeeklyCheckinsColumns();
        if (!dbCols.has('coach_respondido_em')) {
          return res.json({ count: 0, migration_pending: true });
        }

        let result;
        if (req.user.role === 'admin' && !req.coachScope?.coachIds) {
          result = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM public.weekly_checkins w
             WHERE w.coach_respondido_em IS NULL
               AND w.created_at >= (now() - interval '30 days')`,
          );
        } else {
          const ids = effectiveCoachIds(req.coachScope) || [req.user.id];
          result = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM public.weekly_checkins w
             INNER JOIN public.alunos a ON a.id = w.aluno_id AND a.coach_id = ANY($1::uuid[])
             WHERE w.coach_respondido_em IS NULL
               AND w.created_at >= (now() - interval '30 days')`,
            [ids],
          );
        }
        return res.json({ count: result.rows[0]?.count ?? 0 });
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao contar pendentes' });
      }
    },
  );

  router.patch(
    '/weekly-checkins/:id/respondido',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const dbCols = await loadWeeklyCheckinsColumns();
        if (!dbCols.has('coach_respondido_em')) {
          return res.status(503).json({
            error: 'Migração pendente: coach_respondido_em',
            error_code: 'MIGRATION_PENDING',
          });
        }

        const { id } = req.params;
        const existing = await pool.query(
          `SELECT w.id, w.aluno_id, a.coach_id
           FROM public.weekly_checkins w
           INNER JOIN public.alunos a ON a.id = w.aluno_id
           WHERE w.id = $1`,
          [id],
        );
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: 'Check-in não encontrado', error_code: 'NOT_FOUND' });
        }
        if (req.user.role !== 'admin') {
          const ok = await assertCoachCanAccessAluno(
            pool,
            req.coachScope,
            existing.rows[0].aluno_id,
          );
          if (!ok) {
            return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
          }
        }

        const upd = await pool.query(
          `UPDATE public.weekly_checkins
           SET coach_respondido_em = now(), coach_respondido_por = $1
           WHERE id = $2
           RETURNING *`,
          [req.user.id, id],
        );
        return res.json(upd.rows[0]);
      } catch (error) {
        console.error('Erro ao marcar check-in respondido:', error);
        return res.status(500).json({ error: error.message || 'Erro ao marcar respondido' });
      }
    },
  );

  router.patch(
    '/weekly-checkins/:id/resposta',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'assistant']),
    attachCoachScope,
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const dbCols = await loadWeeklyCheckinsColumns();
        if (!dbCols.has('coach_respondido_em')) {
          return res.status(503).json({
            error: 'Migração pendente: coach_respondido_em',
            error_code: 'MIGRATION_PENDING',
          });
        }
        if (!dbCols.has('coach_resposta')) {
          return res.status(503).json({
            error: 'Migração pendente: coach_resposta',
            error_code: 'MIGRATION_PENDING',
          });
        }

        const { resposta } = req.body || {};
        if (!resposta || !String(resposta).trim()) {
          return res.status(400).json({
            error: 'resposta é obrigatória',
            error_code: 'MISSING_RESPOSTA',
          });
        }

        const { id } = req.params;
        const existing = await pool.query(
          `SELECT w.id, w.aluno_id, a.coach_id
           FROM public.weekly_checkins w
           INNER JOIN public.alunos a ON a.id = w.aluno_id
           WHERE w.id = $1`,
          [id],
        );
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: 'Check-in não encontrado', error_code: 'NOT_FOUND' });
        }
        if (req.user.role !== 'admin') {
          const ok = await assertCoachCanAccessAluno(
            pool,
            req.coachScope,
            existing.rows[0].aluno_id,
          );
          if (!ok) {
            return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
          }
        }

        const upd = await pool.query(
          `UPDATE public.weekly_checkins
           SET coach_resposta = $1,
               coach_respondido_em = COALESCE(coach_respondido_em, now()),
               coach_respondido_por = COALESCE(coach_respondido_por, $2)
           WHERE id = $3
           RETURNING *`,
          [String(resposta).trim(), req.user.id, id],
        );

        const checkinRow = upd.rows[0];
        const alunoId = existing.rows[0].aluno_id;

        if (notificationService && checkinRow?.id && alunoId) {
          let coachNome = null;
          try {
            const coachR = await pool.query(
              `SELECT cp.nome_completo FROM public.coach_profiles cp WHERE cp.user_id = $1 LIMIT 1`,
              [req.user.id],
            );
            coachNome = coachR.rows[0]?.nome_completo || null;
          } catch {
            /* opcional */
          }
          void notificationService
            .notifyCheckinRespondido({
              alunoId,
              checkinId: checkinRow.id,
              coachNome,
            })
            .catch((err) => {
              console.warn('[checkin] Falha ao notificar aluno:', err?.message || err);
            });
        }

        return res.json(checkinRow);
      } catch (error) {
        console.error('Erro ao salvar resposta do check-in:', error);
        return res.status(500).json({ error: error.message || 'Erro ao salvar resposta' });
      }
    },
  );

  router.get(
    '/weekly-checkins',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno', 'coach', 'admin', 'assistant']),
    requireAlunoWhenStudent(),
    attachCoachScope,
    async (req, res) => {
      try {
        const searchPattern = parseWeeklyCheckinSearchQuery(req);

        if (req.user.role === 'admin') {
          if (searchPattern) {
            const r = await pool.query(
              `SELECT w.* FROM public.weekly_checkins w
               LEFT JOIN public.alunos a ON a.id = w.aluno_id
               WHERE w.nao_cumpriu_porque ILIKE $1 ESCAPE '\\'
                  OR a.nome ILIKE $1 ESCAPE '\\'
               ORDER BY w.created_at DESC NULLS LAST
               LIMIT 500`,
              [searchPattern],
            );
            return res.json(r.rows);
          }
          const r = await pool.query(
            `SELECT * FROM public.weekly_checkins ORDER BY created_at DESC NULLS LAST LIMIT 500`,
          );
          return res.json(r.rows);
        }
        if (req.user.role === 'coach' || req.user.role === 'assistant') {
          const ids = effectiveCoachIds(req.coachScope) || [req.user.id];
          if (searchPattern) {
            const r = await pool.query(
              `SELECT w.* FROM public.weekly_checkins w
               INNER JOIN public.alunos a ON a.id = w.aluno_id AND a.coach_id = ANY($1::uuid[])
               WHERE w.nao_cumpriu_porque ILIKE $2 ESCAPE '\\'
                  OR a.nome ILIKE $2 ESCAPE '\\'
               ORDER BY w.created_at DESC NULLS LAST
               LIMIT 500`,
              [ids, searchPattern],
            );
            return res.json(r.rows);
          }
          const r = await pool.query(
            `SELECT w.* FROM public.weekly_checkins w
             INNER JOIN public.alunos a ON a.id = w.aluno_id AND a.coach_id = ANY($1::uuid[])
             ORDER BY w.created_at DESC NULLS LAST LIMIT 500`,
            [ids],
          );
          return res.json(r.rows);
        }
        if (searchPattern) {
          const r = await pool.query(
            `SELECT * FROM public.weekly_checkins
             WHERE aluno_id = $1
               AND nao_cumpriu_porque ILIKE $2 ESCAPE '\\'
             ORDER BY created_at DESC NULLS LAST`,
            [req.aluno.id, searchPattern],
          );
          return res.json(r.rows);
        }
        const r = await pool.query(
          `SELECT * FROM public.weekly_checkins WHERE aluno_id = $1 ORDER BY created_at DESC NULLS LAST`,
          [req.aluno.id],
        );
        return res.json(r.rows);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao listar check-ins' });
      }
    },
  );

  // ============================================================================
  // ROTA: /api/checkins - Validar e criar check-in semanal
  // ============================================================================
  // VPS-NATIVE-ARCH-ALUNOS-COACH-001
  // Resolve aluno canônico via resolveAlunoOrFail
  // Coach_id é inferido via aluno (aluno sempre pertence a um coach)
  // ============================================================================

  const {
    startOfCalendarWeek,
    hasCheckinThisWeek,
    startOfNextCalendarWeek,
  } = require('../utils/checkin-week');
  const { parsePesoKg, MIN_KG, MAX_KG } = require('../utils/checkin-peso');
  const { validateCheckinFieldValues, mapCheckinDbError } = require('../utils/checkin-field-validation');

  const MIN_CHECKIN_PHOTOS = 2;

  // POST /api/checkins - Criar check-in semanal
  // DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Rota apenas para alunos
  router.post('/checkins', authenticate, domainSchemaGuard, validateRole(['aluno']), resolveAlunoOrFail, async (req, res) => {
    try {
      const aluno = req.aluno; // Já resolvido pelo middleware resolveAlunoOrFail
      const userId = req.user.id;

      const weekStart = startOfCalendarWeek();
      const existingWeek = await pool.query(
        `SELECT id, created_at
         FROM public.weekly_checkins
         WHERE aluno_id = $1 AND created_at >= $2::timestamptz
         ORDER BY created_at DESC
         LIMIT 1`,
        [aluno.id, weekStart.toISOString()],
      );
      if (hasCheckinThisWeek(existingWeek.rows)) {
        return res.status(409).json({
          error: 'Você já enviou o check-in desta semana. O próximo estará disponível na segunda-feira.',
          error_code: 'CHECKIN_ALREADY_THIS_WEEK',
          existing_checkin_id: existingWeek.rows[0].id,
          submitted_at: existingWeek.rows[0].created_at,
          next_available_at: startOfNextCalendarWeek().toISOString(),
        });
      }

      // Validar se aluno_id fornecido (se houver) corresponde ao aluno do usuário
      // Frontend nunca deve enviar aluno_id - backend sempre resolve via linked_user_id
      if (req.body.aluno_id && req.body.aluno_id !== aluno.id) {
        return res.status(403).json({
          error: 'Aluno inválido',
          error_code: 'ALUNO_MISMATCH',
          message: 'O aluno_id fornecido não corresponde ao seu perfil.'
        });
      }

      // Coach_id é inferido via aluno (aluno sempre pertence a um coach)
      if (!aluno.coach_id) {
        return res.status(400).json({
          error: 'Aluno sem coach vinculado',
          error_code: 'COACH_NOT_FOUND',
          message: 'Seu aluno não tem um coach vinculado.'
        });
      }

      const dbCols = await loadWeeklyCheckinsColumns();
      const isLegacyWeekly = dbCols.has('adesao_dieta') && !dbCols.has('beliscou_fora_plano');

      const CHECKIN_WRITABLE = new Set([
        'beliscou_fora_plano',
        'seguiu_plano_nota',
        'apetite',
        'treinou_todas_sessoes',
        'desafiou_treinos',
        'fez_cardio',
        'seguiu_suplementacao',
        'recursos_hormonais',
        'ingeriu_agua_minima',
        'exposicao_sol',
        'pressao_arterial',
        'glicemia',
        'media_horas_sono',
        'dificuldade_adormecer',
        'acordou_noite',
        'estresse_semana',
        'lida_desafios',
        'convivio_familiar',
        'convivio_trabalho',
        'postura_problemas',
        'higiene_sono',
        'autoestima',
        'media_evacuacoes',
        'formato_fezes',
        'nao_cumpriu_porque',
        'status',
        'peso_kg',
      ]);

      const REQUIRED_CHECKIN = [
        'beliscou_fora_plano',
        'seguiu_plano_nota',
        'apetite',
        'treinou_todas_sessoes',
        'desafiou_treinos',
        'fez_cardio',
        'seguiu_suplementacao',
        'recursos_hormonais',
        'ingeriu_agua_minima',
        'exposicao_sol',
        'media_horas_sono',
        'dificuldade_adormecer',
        'estresse_semana',
        'lida_desafios',
        'convivio_familiar',
        'convivio_trabalho',
        'postura_problemas',
        'higiene_sono',
        'autoestima',
        'media_evacuacoes',
        'formato_fezes',
      ];

      let columns;
      let values;
      let pesoKg = null;
      let fotosInput = [];

      if (isLegacyWeekly) {
        const tipoToBristol = (t) => {
          const m = String(t || '').match(/(\d)/);
          return m ? parseInt(m[1], 10) : null;
        };
        const horasToQual = (h) => {
          if (h === '6-8') return 8;
          if (h === '5-6') return 6;
          if (h === '4-5') return 4;
          return 6;
        };
        const legacyRow = {};
        if (dbCols.has('adesao_dieta')) {
          const n = parseInt(String(req.body.seguiu_plano_nota), 10);
          if (Number.isNaN(n)) {
            return res.status(400).json({
              error: 'seguiu_plano_nota inválido',
              error_code: 'CHECKIN_MISSING_FIELDS',
            });
          }
          legacyRow.adesao_dieta = n;
        }
        if (dbCols.has('adesao_treino')) {
          legacyRow.adesao_treino = req.body.treinou_todas_sessoes ? 8 : 3;
        }
        if (dbCols.has('escala_bristol') && req.body.formato_fezes) {
          const b = tipoToBristol(req.body.formato_fezes);
          if (b != null) legacyRow.escala_bristol = b;
        }
        if (dbCols.has('qualidade_sono') && req.body.media_horas_sono) {
          legacyRow.qualidade_sono = horasToQual(req.body.media_horas_sono);
        }
        if (dbCols.has('nivel_estresse')) {
          legacyRow.nivel_estresse = req.body.estresse_semana ? 8 : 3;
        }
        if (dbCols.has('nivel_energia') && req.body.autoestima != null) {
          legacyRow.nivel_energia = parseInt(String(req.body.autoestima), 10);
        }
        if (dbCols.has('observacoes')) {
          legacyRow.observacoes = req.body.nao_cumpriu_porque || null;
        }
        if (dbCols.has('data_checkin')) {
          legacyRow.data_checkin = new Date().toISOString().slice(0, 10);
        }
        columns = Object.keys(legacyRow);
        values = Object.values(legacyRow);
        if (columns.length === 0) {
          return res.status(400).json({
            error: 'Schema de check-in legado não suportado nesta base',
            error_code: 'CHECKIN_SCHEMA_UNSUPPORTED',
          });
        }
      } else {
        const insertData = {};
        for (const key of CHECKIN_WRITABLE) {
          if (req.body[key] === undefined) continue;
          let v = req.body[key];
          if (v === '') v = null;
          insertData[key] = v;
        }

        if (insertData.seguiu_plano_nota != null) {
          insertData.seguiu_plano_nota = parseInt(String(insertData.seguiu_plano_nota), 10);
        }
        if (insertData.autoestima != null) {
          insertData.autoestima = parseInt(String(insertData.autoestima), 10);
        }

        for (const k of Object.keys(insertData)) {
          if (!dbCols.has(k)) delete insertData[k];
        }

        pesoKg = dbCols.has('peso_kg') ? parsePesoKg(req.body.peso_kg) : null;
        if (dbCols.has('peso_kg') && pesoKg == null) {
          return res.status(400).json({
            error: `Peso inválido. Informe um valor entre ${MIN_KG} e ${MAX_KG} kg.`,
            error_code: 'CHECKIN_PESO_INVALID',
          });
        }
        if (pesoKg != null) insertData.peso_kg = pesoKg;

        const missing = REQUIRED_CHECKIN.filter(
          (k) => insertData[k] === undefined || insertData[k] === null || insertData[k] === '',
        );
        if (missing.length > 0) {
          return res.status(400).json({
            error: 'Campos obrigatórios em falta no check-in',
            error_code: 'CHECKIN_MISSING_FIELDS',
            missing_fields: missing,
          });
        }

        fotosInput = Array.isArray(req.body.fotos) ? req.body.fotos : [];
        if (fotosInput.length < MIN_CHECKIN_PHOTOS) {
          return res.status(400).json({
            error: `Envie pelo menos ${MIN_CHECKIN_PHOTOS} fotos no check-in semanal.`,
            error_code: 'CHECKIN_PHOTOS_REQUIRED',
            min_photos: MIN_CHECKIN_PHOTOS,
          });
        }
        for (const f of fotosInput) {
          if (!f?.url || typeof f.url !== 'string' || !String(f.url).trim()) {
            return res.status(400).json({
              error: 'Cada foto deve ter uma URL válida',
              error_code: 'CHECKIN_PHOTOS_INVALID',
            });
          }
        }

        columns = Object.keys(insertData);
        values = Object.values(insertData);

        const fieldValidation = validateCheckinFieldValues(insertData);
        if (!fieldValidation.ok) {
          return res.status(400).json({
            error: fieldValidation.message,
            error_code: 'CHECKIN_VALIDATION',
            field: fieldValidation.field,
          });
        }
      }

      const placeholders = values.map((_, i) => `$${i + 2}`).join(', ');

      const query = `
                INSERT INTO public.weekly_checkins (aluno_id, ${columns.join(', ')})
                VALUES ($1, ${placeholders})
                RETURNING *
            `;

      const client = await pool.connect();
      let createdCheckin;
      try {
        await client.query('BEGIN');
        const result = await client.query(query, [aluno.id, ...values]);
        createdCheckin = result.rows[0];

        const hasCheckinPhotoCol = (
          await client.query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'fotos_alunos' AND column_name = 'weekly_checkin_id'`,
          )
        ).rows.length > 0;

        for (const f of fotosInput) {
          const url = String(f.url).trim();
          const descricao = f.descricao != null ? String(f.descricao) : null;
          if (hasCheckinPhotoCol) {
            await client.query(
              `INSERT INTO public.fotos_alunos (aluno_id, url, descricao, weekly_checkin_id)
               VALUES ($1, $2, $3, $4)`,
              [aluno.id, url, descricao, createdCheckin.id],
            );
          } else {
            await client.query(
              `INSERT INTO public.fotos_alunos (aluno_id, url, descricao)
               VALUES ($1, $2, $3)`,
              [aluno.id, url, descricao],
            );
          }
        }

        if (pesoKg != null && dbCols.has('peso_kg')) {
          await client.query(`UPDATE public.alunos SET peso = $1 WHERE id = $2`, [
            Math.round(pesoKg),
            aluno.id,
          ]);
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      if (notificationService && aluno.coach_id && createdCheckin?.id) {
        void notificationService
          .notifyNewWeeklyCheckin({
            checkinId: createdCheckin.id,
            alunoId: aluno.id,
            alunoNome: aluno.nome,
            coachUserId: aluno.coach_id,
            checkin: createdCheckin,
          })
          .catch((notifyErr) => {
            console.warn('[checkin] Falha ao notificar coach:', notifyErr?.message || notifyErr);
          });
      }

      res.status(201).json({
        success: true,
        checkin: createdCheckin,
        aluno: {
          id: aluno.id,
          nome: aluno.nome
        }
      });
    } catch (error) {
      console.error('Erro ao criar check-in:', error);
      const mapped = mapCheckinDbError(error);
      if (mapped) {
        return res.status(400).json(mapped);
      }
      res.status(500).json({
        error: error.message || 'Erro ao criar check-in',
        error_code: 'CHECKIN_CREATE_ERROR'
      });
    }
  });

  // ============================================================================
  // ROTAS: CONVERSAS + MENSAGENS
  // ============================================================================
  // Aluno: envia/recebe na sua conversa com o coach.
  // Coach: lista conversas, responde alunos (conversa_id + conteúdo), lê todas as mensagens das suas conversas.
  // Admin: visão global (mesmo padrão de GET /conversas).
  // ============================================================================

  const isStaffMessagingRole = (role) => role === 'coach' || role === 'admin';

  // GET /api/conversas — coach e admin
  router.get('/conversas', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), async (req, res) => {
    try {
      if (req.user.role === 'admin') {
        const result = await pool.query(
          'SELECT * FROM public.conversas ORDER BY ultima_mensagem_em DESC NULLS LAST, updated_at DESC'
        );
        return res.json(result.rows);
      }
      const result = await pool.query(
        `SELECT * FROM public.conversas WHERE coach_id = $1
         ORDER BY ultima_mensagem_em DESC NULLS LAST, updated_at DESC`,
        [req.user.id]
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar conversas:', error);
      return res.status(500).json({ error: error.message || 'Erro ao listar conversas' });
    }
  });

  // POST /api/conversas — coach ou admin: criar ou devolver conversa com aluno
  router.post('/conversas', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), async (req, res) => {
    try {
      const { aluno_id: alunoIdBody } = req.body;
      if (!alunoIdBody) {
        return res.status(400).json({ error: 'aluno_id é obrigatório', error_code: 'MISSING_ALUNO_ID' });
      }
      const alunoRes = await pool.query('SELECT id, coach_id FROM public.alunos WHERE id = $1', [alunoIdBody]);
      if (alunoRes.rows.length === 0) {
        return res.status(404).json({ error: 'Aluno não encontrado', error_code: 'ALUNO_NOT_FOUND' });
      }
      const alunoRow = alunoRes.rows[0];
      const coachId =
        req.user.role === 'admin' ? alunoRow.coach_id : req.user.id;
      if (!coachId) {
        return res.status(400).json({ error: 'Aluno sem coach vinculado', error_code: 'COACH_NOT_FOUND' });
      }
      if (req.user.role === 'coach' && String(alunoRow.coach_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Aluno não pertence a este coach', error_code: 'FORBIDDEN' });
      }
      const ex = await pool.query(
        'SELECT * FROM public.conversas WHERE aluno_id = $1 AND coach_id = $2',
        [alunoIdBody, coachId]
      );
      if (ex.rows.length > 0) {
        return res.status(200).json(ex.rows[0]);
      }
      const ins = await pool.query(
        'INSERT INTO public.conversas (aluno_id, coach_id) VALUES ($1, $2) RETURNING *',
        [alunoIdBody, coachId]
      );
      return res.status(201).json(ins.rows[0]);
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      return res.status(500).json({ error: error.message || 'Erro ao criar conversa' });
    }
  });

  // PATCH /api/conversas/:id — coach ou admin: atualizar última mensagem / metadados
  router.patch('/conversas/:id', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;
      const convQuery =
        req.user.role === 'admin'
          ? 'SELECT * FROM public.conversas WHERE id = $1'
          : 'SELECT * FROM public.conversas WHERE id = $1 AND coach_id = $2';
      const convParams = req.user.role === 'admin' ? [id] : [id, req.user.id];
      const c = await pool.query(convQuery, convParams);
      if (c.rows.length === 0) {
        return res.status(404).json({ error: 'Conversa não encontrada', error_code: 'CONVERSA_NOT_FOUND' });
      }
      const allowed = new Set(['ultima_mensagem', 'ultima_mensagem_em']);
      const updates = {};
      for (const [k, v] of Object.entries(req.body || {})) {
        if (allowed.has(k)) updates[k] = v;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido', error_code: 'NO_FIELDS' });
      }
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClause = keys.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const r = await pool.query(
        `UPDATE public.conversas SET ${setClause}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
        [...vals, id]
      );
      return res.json(r.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar conversa:', error);
      return res.status(500).json({ error: error.message || 'Erro ao atualizar conversa' });
    }
  });

  // POST /api/mensagens — aluno, coach ou admin
  router.post('/mensagens', authenticate, domainSchemaGuard, validateRole(['aluno', 'coach', 'admin']), requireAlunoWhenStudent(), async (req, res) => {
    try {
      const { conversa_id, conteudo } = req.body;

      if (!conteudo || !conteudo.trim()) {
        return res.status(400).json({
          error: 'Conteúdo da mensagem é obrigatório',
          error_code: 'CONTENT_REQUIRED',
        });
      }

      const userId = req.user.id;

      if (isStaffMessagingRole(req.user.role)) {
        if (!conversa_id || typeof conversa_id !== 'string') {
          return res.status(400).json({
            error: 'conversa_id é obrigatório para o coach',
            error_code: 'MISSING_CONVERSA_ID',
          });
        }
        const convQuery =
          req.user.role === 'admin'
            ? 'SELECT id FROM public.conversas WHERE id = $1'
            : 'SELECT id FROM public.conversas WHERE id = $1 AND coach_id = $2';
        const convParams = req.user.role === 'admin' ? [conversa_id] : [conversa_id, userId];
        const convRes = await pool.query(convQuery, convParams);
        if (convRes.rows.length === 0) {
          return res.status(404).json({ error: 'Conversa não encontrada', error_code: 'CONVERSA_NOT_FOUND' });
        }
        const mensagemResult = await pool.query(
          `INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, lida)
           VALUES ($1, $2, $3, false)
           RETURNING *`,
          [conversa_id, userId, conteudo.trim()]
        );
        await pool.query(
          'UPDATE public.conversas SET ultima_mensagem = $1, ultima_mensagem_em = now(), updated_at = now() WHERE id = $2',
          [conteudo.trim(), conversa_id]
        );
        return res.status(201).json(mensagemResult.rows[0]);
      }

      const aluno = req.aluno;

      if (!aluno.coach_id) {
        return res.status(400).json({
          error: 'Aluno sem coach vinculado',
          error_code: 'COACH_NOT_FOUND',
        });
      }

      let conversa;
      if (conversa_id) {
        if (!conversa_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
          return res.status(400).json({
            error: 'conversa_id inválido',
            error_code: 'INVALID_UUID',
          });
        }

        const conversaResult = await pool.query(
          'SELECT * FROM public.conversas WHERE id = $1 AND aluno_id = $2',
          [conversa_id, aluno.id]
        );

        if (conversaResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Conversa não encontrada',
            error_code: 'CONVERSA_NOT_FOUND',
          });
        }

        conversa = conversaResult.rows[0];
      } else {
        const existingConversa = await pool.query(
          'SELECT * FROM public.conversas WHERE aluno_id = $1 AND coach_id = $2 LIMIT 1',
          [aluno.id, aluno.coach_id],
        );

        if (existingConversa.rows.length === 0) {
          const novaConversa = await pool.query(
            'INSERT INTO public.conversas (aluno_id, coach_id) VALUES ($1, $2) RETURNING *',
            [aluno.id, aluno.coach_id],
          );
          conversa = novaConversa.rows[0];
        } else {
          conversa = existingConversa.rows[0];
        }
      }

      const mensagemResult = await pool.query(
        `INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, lida)
         VALUES ($1, $2, $3, false)
         RETURNING *`,
        [conversa.id, userId, conteudo.trim()]
      );

      await pool.query(
        'UPDATE public.conversas SET ultima_mensagem = $1, ultima_mensagem_em = now(), updated_at = now() WHERE id = $2',
        [conteudo.trim(), conversa.id]
      );

      return res.status(201).json(mensagemResult.rows[0]);
    } catch (error) {
      if (error.code === 'ALUNO_NOT_LINKED') {
        return res.status(403).json({
          error: 'Aluno não vinculado',
          error_code: 'ALUNO_NOT_LINKED',
          message: 'Seu perfil não está vinculado a um aluno.',
        });
      }

      console.error('Erro ao enviar mensagem:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao enviar mensagem',
        error_code: 'MESSAGE_SEND_ERROR',
      });
    }
  });

  // GET /api/mensagens — aluno (sua conversa) ou coach/admin (todas ou filtro conversa_id)
  router.get('/mensagens', authenticate, domainSchemaGuard, validateRole(['aluno', 'coach', 'admin']), requireAlunoWhenStudent(), async (req, res) => {
    try {
      const { conversaId, conversa_id: conversaIdSnake, status } = req.query;
      const qConversa = conversaId || conversaIdSnake;

      if (isStaffMessagingRole(req.user.role)) {
        if (req.user.role === 'admin') {
          if (qConversa) {
            const mensagensResult = await pool.query(
              `SELECT m.id, m.conversa_id, m.remetente_id, m.conteudo, m.lida, m.created_at
               FROM public.mensagens m WHERE m.conversa_id = $1 ORDER BY m.created_at ASC`,
              [qConversa]
            );
            return res.json(mensagensResult.rows);
          }
          const all = await pool.query(
            `SELECT m.id, m.conversa_id, m.remetente_id, m.conteudo, m.lida, m.created_at
             FROM public.mensagens m
             ORDER BY m.created_at ASC`
          );
          return res.json(all.rows);
        }

        const coachId = req.user.id;
        if (qConversa) {
          const c = await pool.query('SELECT id FROM public.conversas WHERE id = $1 AND coach_id = $2', [
            qConversa,
            coachId,
          ]);
          if (c.rows.length === 0) {
            return res.status(403).json({
              error: 'Conversa não pertence a este coach',
              error_code: 'CONVERSA_MISMATCH',
            });
          }
          const mensagensResult = await pool.query(
            `SELECT m.id, m.conversa_id, m.remetente_id, m.conteudo, m.lida, m.created_at
             FROM public.mensagens m WHERE m.conversa_id = $1 ORDER BY m.created_at ASC`,
            [qConversa]
          );
          return res.json(mensagensResult.rows);
        }
        const all = await pool.query(
          `SELECT m.id, m.conversa_id, m.remetente_id, m.conteudo, m.lida, m.created_at
           FROM public.mensagens m
           INNER JOIN public.conversas c ON c.id = m.conversa_id
           WHERE c.coach_id = $1
           ORDER BY m.created_at ASC`,
          [coachId]
        );
        return res.json(all.rows);
      }

      const aluno = req.aluno;
      if (!aluno) {
        return res.status(403).json({
          error: 'Perfil de aluno não encontrado',
          error_code: 'ALUNO_NOT_LINKED',
        });
      }

      const conversaResult = await pool.query('SELECT * FROM public.conversas WHERE aluno_id = $1 LIMIT 1', [
        aluno.id,
      ]);

      if (conversaResult.rows.length === 0) {
        return res.json([]);
      }

      const conversa = conversaResult.rows[0];

      let query = `
        SELECT m.id, m.conversa_id, m.remetente_id, m.conteudo, m.lida, m.created_at
        FROM public.mensagens m
        WHERE m.conversa_id = $1
      `;
      const queryParams = [conversa.id];
      let paramIndex = 2;

      if (qConversa && qConversa !== conversa.id) {
        return res.status(403).json({
          error: 'Conversa não pertence ao aluno',
          error_code: 'CONVERSA_MISMATCH',
        });
      }

      if (status === 'lida' || status === 'true') {
        query += ` AND m.lida = $${paramIndex}`;
        queryParams.push(true);
        paramIndex++;
      } else if (status === 'nao_lida' || status === 'false') {
        query += ` AND m.lida = $${paramIndex}`;
        queryParams.push(false);
        paramIndex++;
      }

      query += ` ORDER BY m.created_at ASC`;

      const mensagensResult = await pool.query(query, queryParams);
      return res.json(mensagensResult.rows);
    } catch (error) {
      if (error.code === 'ALUNO_NOT_LINKED') {
        return res.status(403).json({
          error: 'Aluno não vinculado',
          error_code: 'ALUNO_NOT_LINKED',
        });
      }

      console.error('Erro ao listar mensagens:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao listar mensagens',
        error_code: 'MESSAGES_LIST_ERROR',
      });
    }
  });

  // PATCH /api/mensagens/:id — aluno, coach ou admin marca como lida mensagem recebida
  router.patch('/mensagens/:id', authenticate, domainSchemaGuard, validateRole(['aluno', 'coach', 'admin']), requireAlunoWhenStudent(), validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (isStaffMessagingRole(req.user.role)) {
        const msgQuery =
          req.user.role === 'admin'
            ? `SELECT m.id, m.remetente_id, m.conversa_id
               FROM public.mensagens m WHERE m.id = $1`
            : `SELECT m.id, m.remetente_id, m.conversa_id
               FROM public.mensagens m
               INNER JOIN public.conversas c ON c.id = m.conversa_id
               WHERE m.id = $1 AND c.coach_id = $2`;
        const msgParams = req.user.role === 'admin' ? [id] : [id, userId];
        const msgResult = await pool.query(msgQuery, msgParams);
        if (msgResult.rows.length === 0) {
          return res.status(404).json({ error: 'Mensagem não encontrada', error_code: 'MESSAGE_NOT_FOUND' });
        }
        const msg = msgResult.rows[0];
        if (msg.remetente_id === userId) {
          return res.status(403).json({
            error: 'Não é possível marcar como lida a própria mensagem enviada',
            error_code: 'CANNOT_MARK_OWN_MESSAGE',
          });
        }
        const updateResult = await pool.query('UPDATE public.mensagens SET lida = true WHERE id = $1 RETURNING *', [id]);
        return res.json(updateResult.rows[0]);
      }

      const aluno = req.aluno;
      if (!aluno) {
        return res.status(403).json({ error: 'Aluno não vinculado', error_code: 'ALUNO_NOT_LINKED' });
      }

      const conversaResult = await pool.query('SELECT id FROM public.conversas WHERE aluno_id = $1 LIMIT 1', [
        aluno.id,
      ]);
      if (conversaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Conversa não encontrada', error_code: 'CONVERSA_NOT_FOUND' });
      }
      const conversaId = conversaResult.rows[0].id;

      const msgResult = await pool.query(
        'SELECT id, remetente_id, conversa_id FROM public.mensagens WHERE id = $1 AND conversa_id = $2',
        [id, conversaId]
      );
      if (msgResult.rows.length === 0) {
        return res.status(404).json({ error: 'Mensagem não encontrada', error_code: 'MESSAGE_NOT_FOUND' });
      }
      const msg = msgResult.rows[0];
      if (msg.remetente_id === userId) {
        return res.status(403).json({
          error: 'Não é possível marcar como lida a própria mensagem enviada',
          error_code: 'CANNOT_MARK_OWN_MESSAGE',
        });
      }

      const updateResult = await pool.query('UPDATE public.mensagens SET lida = true WHERE id = $1 RETURNING *', [id]);
      return res.json(updateResult.rows[0]);
    } catch (error) {
      if (error.code === 'ALUNO_NOT_LINKED') {
        return res.status(403).json({ error: 'Aluno não vinculado', error_code: 'ALUNO_NOT_LINKED' });
      }
      console.error('Erro ao marcar mensagem como lida:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao marcar mensagem como lida',
        error_code: 'MESSAGE_UPDATE_ERROR',
      });
    }
  });

  // ============================================================================
  // ROTAS: VÍDEOS (YouTube / galeria)
  // ============================================================================
  const VISIBILIDADES_VIDEO = ['active-students', 'inactive-students', 'guests', 'everyone'];

  // GET /api/videos — coach: próprios vídeos; aluno: vídeos do coach com visibilidade permitida no portal
  router.get('/videos', authenticate, domainSchemaGuard, validateRole(['coach', 'aluno']), async (req, res) => {
    try {
      if (req.user.role === 'coach') {
        const result = await pool.query(
          `SELECT * FROM public.videos WHERE coach_id = $1 ORDER BY created_at DESC`,
          [req.user.id]
        );
        return res.json(result.rows);
      }

      const alunoRow = await getAlunoRowForAuthUser(req.user.id);
      if (!alunoRow || !alunoRow.coach_id) {
        return res.json([]);
      }

      const coachId = alunoRow.coach_id;
      const result = await pool.query(
        `SELECT * FROM public.videos
         WHERE coach_id = $1
           AND visibilidade IN ('everyone', 'active-students')
         ORDER BY created_at DESC`,
        [coachId]
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar vídeos:', error);
      res.status(500).json({
        error: error.message || 'Erro ao listar vídeos',
        error_code: 'VIDEOS_LIST_ERROR'
      });
    }
  });

  // POST /api/videos — apenas coach
  router.post('/videos', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, async (req, res) => {
    try {
      const {
        titulo,
        descricao,
        youtube_id,
        duracao,
        categoria,
        visibilidade,
        tags,
        instrutor
      } = req.body || {};

      if (!titulo || !youtube_id || !categoria || !visibilidade) {
        return res.status(400).json({
          error: 'titulo, youtube_id, categoria e visibilidade são obrigatórios',
          error_code: 'MISSING_PARAMETERS'
        });
      }

      if (!VISIBILIDADES_VIDEO.includes(visibilidade)) {
        return res.status(400).json({
          error: 'visibilidade inválida',
          error_code: 'INVALID_VISIBILITY',
          allowed: VISIBILIDADES_VIDEO
        });
      }

      const tagArray = Array.isArray(tags) ? tags : [];
      const coachId = req.user.id;

      const insertResult = await pool.query(
        `INSERT INTO public.videos (
          titulo, descricao, youtube_id, duracao, categoria, visibilidade, tags, instrutor, coach_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9)
        RETURNING *`,
        [
          titulo,
          descricao || null,
          youtube_id,
          duracao || null,
          categoria,
          visibilidade,
          tagArray,
          instrutor || null,
          coachId
        ]
      );

      res.status(201).json(insertResult.rows[0]);
    } catch (error) {
      console.error('Erro ao criar vídeo:', error);
      res.status(500).json({
        error: error.message || 'Erro ao criar vídeo',
        error_code: 'VIDEO_CREATE_ERROR'
      });
    }
  });

  // PATCH /api/videos/:id — apenas coach, apenas vídeos próprios
  router.patch('/videos/:id', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      const allowed = ['titulo', 'descricao', 'youtube_id', 'duracao', 'categoria', 'visibilidade', 'tags', 'instrutor', 'views', 'likes'];
      const updates = [];
      const values = [];

      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          if (key === 'visibilidade' && !VISIBILIDADES_VIDEO.includes(body[key])) {
            return res.status(400).json({
              error: 'visibilidade inválida',
              error_code: 'INVALID_VISIBILITY',
              allowed: VISIBILIDADES_VIDEO
            });
          }
          const p = values.length + 1;
          if (key === 'tags') {
            updates.push(`tags = $${p}::text[]`);
            values.push(Array.isArray(body.tags) ? body.tags : []);
          } else {
            updates.push(`${key} = $${p}`);
            values.push(body[key]);
          }
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar', error_code: 'EMPTY_PATCH' });
      }

      updates.push('updated_at = now()');
      const idParam = values.length + 1;
      const coachParam = values.length + 2;
      values.push(id, req.user.id);

      const query = `
        UPDATE public.videos
        SET ${updates.join(', ')}
        WHERE id = $${idParam} AND coach_id = $${coachParam}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vídeo não encontrado', error_code: 'VIDEO_NOT_FOUND' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao atualizar vídeo:', error);
      res.status(500).json({
        error: error.message || 'Erro ao atualizar vídeo',
        error_code: 'VIDEO_UPDATE_ERROR'
      });
    }
  });

  // DELETE /api/videos/:id — apenas coach, apenas vídeos próprios
  router.delete('/videos/:id', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;
      const del = await pool.query(
        'DELETE FROM public.videos WHERE id = $1 AND coach_id = $2 RETURNING id',
        [id, req.user.id]
      );

      if (del.rows.length === 0) {
        return res.status(404).json({ error: 'Vídeo não encontrado', error_code: 'VIDEO_NOT_FOUND' });
      }

      // 200 + JSON: o api-client faz response.json() em sucesso; 204 sem corpo quebraria o parse.
      res.json({ ok: true, id: del.rows[0].id });
    } catch (error) {
      console.error('Erro ao deletar vídeo:', error);
      res.status(500).json({
        error: error.message || 'Erro ao deletar vídeo',
        error_code: 'VIDEO_DELETE_ERROR'
      });
    }
  });

  // ============================================================================
  // ROTAS: TREINOS (templates e fichas do coach)
  // ============================================================================
  const TREINO_DIFICULDADES = ['Iniciante', 'Intermediário', 'Avançado'];
  const TREINO_WRITABLE = new Set([
    'nome',
    'descricao',
    'duracao',
    'dificuldade',
    'categoria',
    'num_exercicios',
    'is_template',
    'tags',
    'exercicios',
  ]);

  async function fetchTreinoById(treinoId) {
    const r = await pool.query('SELECT * FROM public.treinos WHERE id = $1 LIMIT 1', [treinoId]);
    return r.rows[0] || null;
  }

  async function canReadTreino(req, treinoId) {
    const treino = await fetchTreinoById(treinoId);
    if (!treino) return { treino: null, allowed: false, reason: 'NOT_FOUND' };
    if (req.user.role === 'admin') return { treino, allowed: true };
    if (req.user.role === 'coach' && String(treino.coach_id) === String(req.user.id)) {
      return { treino, allowed: true };
    }
    if (req.user.role === 'aluno') {
      const alunoRow = await getAlunoRowForAuthUser(req.user.id);
      if (!alunoRow) return { treino, allowed: false, reason: 'FORBIDDEN' };
      const link = await pool.query(
        `SELECT 1 FROM public.alunos_treinos
         WHERE aluno_id = $1 AND treino_id = $2
         LIMIT 1`,
        [alunoRow.id, treinoId],
      );
      if (link.rows.length > 0) return { treino, allowed: true };
    }
    return { treino, allowed: false, reason: 'FORBIDDEN' };
  }

  // GET /api/treinos — coach: próprios treinos; admin: todos
  router.get('/treinos', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), async (req, res) => {
    try {
      if (req.user.role === 'admin') {
        const result = await pool.query(
          `SELECT * FROM public.treinos ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
        );
        return res.json(result.rows);
      }
      const result = await pool.query(
        `SELECT * FROM public.treinos WHERE coach_id = $1 ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
        [req.user.id],
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar treinos:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao listar treinos',
        error_code: 'TREINOS_LIST_ERROR',
      });
    }
  });

  // GET /api/treinos/:id — coach (próprio), admin, aluno (se atribuído)
  router.get('/treinos/:id', authenticate, domainSchemaGuard, validateRole(['coach', 'admin', 'aluno']), validateUUIDParam('id'), async (req, res) => {
    try {
      const access = await canReadTreino(req, req.params.id);
      if (!access.treino) {
        return res.status(404).json({ error: 'Treino não encontrado', error_code: 'TREINO_NOT_FOUND' });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: 'Acesso negado', error_code: 'TREINO_FORBIDDEN' });
      }
      return res.json(access.treino);
    } catch (error) {
      console.error('Erro ao buscar treino:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao buscar treino',
        error_code: 'TREINO_GET_ERROR',
      });
    }
  });

  // POST /api/treinos — coach
  router.post('/treinos', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, async (req, res) => {
    try {
      const body = req.body || {};
      const nome = body.nome != null ? String(body.nome).trim() : '';
      const categoria = body.categoria != null ? String(body.categoria).trim() : '';
      const dificuldade = body.dificuldade != null ? String(body.dificuldade).trim() : '';

      if (!nome || !categoria || !dificuldade) {
        return res.status(400).json({
          error: 'nome, categoria e dificuldade são obrigatórios',
          error_code: 'MISSING_PARAMETERS',
        });
      }
      if (!TREINO_DIFICULDADES.includes(dificuldade)) {
        return res.status(400).json({
          error: 'dificuldade inválida',
          error_code: 'INVALID_DIFFICULTY',
          allowed: TREINO_DIFICULDADES,
        });
      }

      const duracao = parseInt(String(body.duracao ?? 60), 10);
      const numExercicios =
        body.num_exercicios != null
          ? parseInt(String(body.num_exercicios), 10)
          : Array.isArray(body.exercicios)
            ? body.exercicios.length
            : 0;
      const tags = Array.isArray(body.tags) ? body.tags : [];
      const exercicios = Array.isArray(body.exercicios) ? body.exercicios : [];
      const isTemplate = body.is_template === true;

      const insertResult = await pool.query(
        `INSERT INTO public.treinos (
          nome, descricao, duracao, dificuldade, categoria, num_exercicios,
          is_template, tags, exercicios, coach_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::jsonb, $10, now())
        RETURNING *`,
        [
          nome,
          body.descricao != null ? String(body.descricao) : null,
          Number.isNaN(duracao) ? 60 : duracao,
          dificuldade,
          categoria,
          Number.isNaN(numExercicios) ? exercicios.length : numExercicios,
          isTemplate,
          tags,
          JSON.stringify(exercicios),
          req.user.id,
        ],
      );
      return res.status(201).json(insertResult.rows[0]);
    } catch (error) {
      console.error('Erro ao criar treino:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao criar treino',
        error_code: 'TREINO_CREATE_ERROR',
      });
    }
  });

  // PATCH /api/treinos/:id — coach, apenas treinos próprios
  router.patch('/treinos/:id', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const existing = await pool.query(
        'SELECT id FROM public.treinos WHERE id = $1 AND coach_id = $2 LIMIT 1',
        [id, req.user.id],
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Treino não encontrado', error_code: 'TREINO_NOT_FOUND' });
      }

      if (body.dificuldade != null && !TREINO_DIFICULDADES.includes(String(body.dificuldade))) {
        return res.status(400).json({
          error: 'dificuldade inválida',
          error_code: 'INVALID_DIFFICULTY',
          allowed: TREINO_DIFICULDADES,
        });
      }

      const sets = [];
      const values = [];
      let idx = 1;
      for (const [key, raw] of Object.entries(body)) {
        if (!TREINO_WRITABLE.has(key)) continue;
        if (key === 'tags') {
          sets.push(`${key} = $${idx}::text[]`);
          values.push(Array.isArray(raw) ? raw : []);
        } else if (key === 'exercicios') {
          sets.push(`${key} = $${idx}::jsonb`);
          values.push(JSON.stringify(Array.isArray(raw) ? raw : []));
        } else if (key === 'duracao' || key === 'num_exercicios') {
          sets.push(`${key} = $${idx}`);
          values.push(parseInt(String(raw), 10));
        } else if (key === 'is_template') {
          sets.push(`${key} = $${idx}`);
          values.push(raw === true);
        } else {
          sets.push(`${key} = $${idx}`);
          values.push(raw);
        }
        idx += 1;
      }

      if (sets.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para actualizar', error_code: 'NO_FIELDS' });
      }

      sets.push('updated_at = now()');
      values.push(id, req.user.id);
      const updateResult = await pool.query(
        `UPDATE public.treinos SET ${sets.join(', ')}
         WHERE id = $${idx} AND coach_id = $${idx + 1}
         RETURNING *`,
        values,
      );
      return res.json(updateResult.rows[0]);
    } catch (error) {
      console.error('Erro ao actualizar treino:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao actualizar treino',
        error_code: 'TREINO_UPDATE_ERROR',
      });
    }
  });

  // DELETE /api/treinos/:id — coach, apenas treinos próprios
  router.delete('/treinos/:id', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, validateUUIDParam('id'), async (req, res) => {
    try {
      const { id } = req.params;
      const del = await pool.query(
        'DELETE FROM public.treinos WHERE id = $1 AND coach_id = $2 RETURNING id',
        [id, req.user.id],
      );
      if (del.rows.length === 0) {
        return res.status(404).json({ error: 'Treino não encontrado', error_code: 'TREINO_NOT_FOUND' });
      }
      return res.json({ ok: true, id: del.rows[0].id });
    } catch (error) {
      console.error('Erro ao deletar treino:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao deletar treino',
        error_code: 'TREINO_DELETE_ERROR',
      });
    }
  });

  // GET /api/lives — apenas coach; lista lives do coach autenticado
  router.get('/lives', authenticate, domainSchemaGuard, validateRole(['coach']), resolveCoachOrFail, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM public.lives WHERE coach_id = $1 ORDER BY data_agendamento DESC NULLS LAST, hora_agendamento DESC NULLS LAST, created_at DESC`,
        [req.user.id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar lives:', error);
      res.status(500).json({
        error: error.message || 'Erro ao listar lives',
        error_code: 'LIVES_LIST_ERROR'
      });
    }
  });

  // ============================================================================
  // ROTAS GENÉRICAS (/api/:table) - API-CONTRACT-001: PROIBIDAS
  // ============================================================================
  // Sintaxe PostgREST (select=, eq=, neq=, etc) é FORBIDDEN conforme especificação
  // Todas as rotas genéricas foram removidas completamente
  // Use rotas semânticas específicas ao invés:
  // - GET /api/alunos/me (para alunos)
  // - GET /api/alunos/by-coach (para coaches)
  // - GET /api/mensagens (para mensagens)
  // - GET /api/notificacoes (para notificações)
  // ============================================================================

  return router;
};
