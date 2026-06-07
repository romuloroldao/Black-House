// ============================================================================
// ROTAS: CONTEÚDOS EDUCATIVOS (/api/educational-contents/*)
// ============================================================================

const express = require('express');
const router = express.Router();
const { validateUUIDParam, isValidUUID } = require('../utils/uuid-validator');
const validateRole = require('../middleware/validateRole');
const logger = require('../utils/logger');
const { queryAlunoRowsFullForUser } = require('../utils/aluno-resolve-by-user');

const CONTENT_TYPES = new Set(['pdf', 'article', 'video']);

const WRITABLE_FIELDS = [
  'title',
  'description',
  'category',
  'content_type',
  'file_url',
  'article_content',
  'video_url',
  'active',
];

function validateContentPayload(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.title !== undefined) {
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      errors.push('title é obrigatório');
    }
  }

  if (!partial || body.content_type !== undefined) {
    if (!body.content_type || !CONTENT_TYPES.has(String(body.content_type))) {
      errors.push('content_type inválido (pdf, article, video)');
    }
  }

  const type = body.content_type;
  if (type === 'pdf' && !partial && !body.file_url) {
    errors.push('file_url é obrigatório para conteúdo PDF');
  }
  if (type === 'article' && !partial && !body.article_content) {
    errors.push('article_content é obrigatório para artigo');
  }
  if (type === 'video' && !partial && !body.video_url) {
    errors.push('video_url é obrigatório para vídeo');
  }

  return errors;
}

async function getAlunoRowForAuthUser(pool, userId) {
  const rows = await queryAlunoRowsFullForUser(pool, userId);
  return rows[0] || null;
}

async function assertAlunoCanReadContent(pool, userId, contentId) {
  const aluno = await getAlunoRowForAuthUser(pool, userId);
  if (!aluno?.coach_id) {
    const err = new Error('Aluno não vinculado');
    err.statusCode = 403;
    err.error_code = 'FORBIDDEN';
    throw err;
  }

  const r = await pool.query(
    `SELECT ec.*
     FROM public.educational_contents ec
     INNER JOIN public.dietas d ON d.refeicao_livre_content_id = ec.id
     WHERE ec.id = $1
       AND ec.coach_id = $2
       AND ec.active = true
       AND d.aluno_id = $3
       AND d.refeicao_livre_ativa = true
       AND COALESCE(d.ativa, true) = true
     LIMIT 1`,
    [contentId, aluno.coach_id, aluno.id],
  );

  if (r.rows.length === 0) {
    const err = new Error('Conteúdo não disponível');
    err.statusCode = 404;
    err.error_code = 'NOT_FOUND';
    throw err;
  }

  return r.rows[0];
}

module.exports = function createEducationalContentsRouter(pool, authenticate, domainSchemaGuard) {
  // GET /api/educational-contents
  router.get('/', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), async (req, res) => {
    try {
      const coachId = req.user.id;
      const { category, q, active } = req.query;
      const conditions = ['coach_id = $1'];
      const values = [coachId];
      let idx = 2;

      if (category && typeof category === 'string' && category.trim()) {
        conditions.push(`category = $${idx++}`);
        values.push(category.trim());
      }

      if (active === 'true' || active === 'false') {
        conditions.push(`active = $${idx++}`);
        values.push(active === 'true');
      }

      if (q && typeof q === 'string' && q.trim().length >= 2) {
        const escaped = q.trim().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
        conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx} OR category ILIKE $${idx})`);
        values.push(`%${escaped}%`);
        idx++;
      }

      const result = await pool.query(
        `SELECT * FROM public.educational_contents
         WHERE ${conditions.join(' AND ')}
         ORDER BY updated_at DESC, created_at DESC`,
        values,
      );

      return res.json(result.rows);
    } catch (error) {
      logger.error('educational_contents.list_error', { error: error.message });
      return res.status(500).json({
        error: error.message || 'Erro ao listar conteúdos',
        error_code: 'EDUCATIONAL_CONTENTS_LIST_ERROR',
      });
    }
  });

  // GET /api/educational-contents/:id
  router.get(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin', 'aluno']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;

        if (req.user.role === 'aluno') {
          const row = await assertAlunoCanReadContent(pool, req.user.id, id);
          return res.json(row);
        }

        const result = await pool.query(
          `SELECT * FROM public.educational_contents WHERE id = $1 AND coach_id = $2`,
          [id, req.user.id],
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'Conteúdo não encontrado',
            error_code: 'NOT_FOUND',
          });
        }

        return res.json(result.rows[0]);
      } catch (error) {
        const status = error.statusCode || 500;
        if (status >= 500) {
          logger.error('educational_contents.get_error', { error: error.message, id: req.params.id });
        }
        return res.status(status).json({
          error: error.message || 'Erro ao buscar conteúdo',
          error_code: error.error_code || 'EDUCATIONAL_CONTENT_GET_ERROR',
        });
      }
    },
  );

  // POST /api/educational-contents
  router.post('/', authenticate, domainSchemaGuard, validateRole(['coach', 'admin']), async (req, res) => {
    try {
      const body = req.body || {};
      const errors = validateContentPayload(body);
      if (errors.length) {
        return res.status(400).json({ error: errors.join('; '), error_code: 'VALIDATION_ERROR' });
      }

      const result = await pool.query(
        `INSERT INTO public.educational_contents (
          coach_id, title, description, category, content_type,
          file_url, article_content, video_url, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, true))
        RETURNING *`,
        [
          req.user.id,
          body.title.trim(),
          body.description?.trim() || null,
          body.category?.trim() || null,
          body.content_type,
          body.file_url?.trim() || null,
          body.article_content?.trim() || null,
          body.video_url?.trim() || null,
          body.active,
        ],
      );

      logger.info('educational_contents.created', { id: result.rows[0].id, coachId: req.user.id });
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('educational_contents.create_error', { error: error.message });
      return res.status(500).json({
        error: error.message || 'Erro ao criar conteúdo',
        error_code: 'EDUCATIONAL_CONTENT_CREATE_ERROR',
      });
    }
  });

  // PUT /api/educational-contents/:id
  router.put(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const body = req.body || {};

        const existing = await pool.query(
          `SELECT * FROM public.educational_contents WHERE id = $1 AND coach_id = $2`,
          [id, req.user.id],
        );
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: 'Conteúdo não encontrado', error_code: 'NOT_FOUND' });
        }

        const merged = { ...existing.rows[0], ...body };
        const errors = validateContentPayload(merged);
        if (errors.length) {
          return res.status(400).json({ error: errors.join('; '), error_code: 'VALIDATION_ERROR' });
        }

        const updates = [];
        const values = [];
        let idx = 1;

        for (const key of WRITABLE_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(body, key)) {
            let val = body[key];
            if (typeof val === 'string') val = val.trim() || null;
            if (key === 'title' && val) val = String(val).trim();
            if (key === 'active' && val != null) val = Boolean(val);
            updates.push(`${key} = $${idx++}`);
            values.push(val);
          }
        }

        if (updates.length === 0) {
          return res.json(existing.rows[0]);
        }

        updates.push(`updated_at = now()`);
        values.push(id, req.user.id);

        const result = await pool.query(
          `UPDATE public.educational_contents
           SET ${updates.join(', ')}
           WHERE id = $${idx++} AND coach_id = $${idx}
           RETURNING *`,
          values,
        );

        logger.info('educational_contents.updated', { id });
        return res.json(result.rows[0]);
      } catch (error) {
        logger.error('educational_contents.update_error', { error: error.message, id: req.params.id });
        return res.status(500).json({
          error: error.message || 'Erro ao atualizar conteúdo',
          error_code: 'EDUCATIONAL_CONTENT_UPDATE_ERROR',
        });
      }
    },
  );

  // DELETE /api/educational-contents/:id
  router.delete(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const { id } = req.params;

        const result = await pool.query(
          `DELETE FROM public.educational_contents WHERE id = $1 AND coach_id = $2 RETURNING id`,
          [id, req.user.id],
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Conteúdo não encontrado', error_code: 'NOT_FOUND' });
        }

        logger.info('educational_contents.deleted', { id });
        return res.json({ ok: true, id });
      } catch (error) {
        logger.error('educational_contents.delete_error', { error: error.message, id: req.params.id });
        return res.status(500).json({
          error: error.message || 'Erro ao excluir conteúdo',
          error_code: 'EDUCATIONAL_CONTENT_DELETE_ERROR',
        });
      }
    },
  );

  return router;
};
