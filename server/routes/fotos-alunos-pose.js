/**
 * Rotas de classificação de pose para fotos de evolução.
 * Montar ANTES de /fotos-alunos/:id.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const validateRole = require('../middleware/validateRole');
const { isValidUUID } = require('../utils/uuid-validator');
const { progressPhotoPoseLimiter } = require('../middleware/rate-limiter');
const { classifyProgressPhotoPose, POSES } = require('../services/progress-photo-pose.service');
const { validateAlunoBelongsToCoach } = require('../utils/identity-resolver');

function isAllowedImage(file) {
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/octet-stream',
  ];
  const mime = String(file.mimetype || '').toLowerCase();
  if (allowed.includes(mime) || mime.startsWith('image/')) return true;
  const ext = path.extname(file.originalname || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(ext);
}

module.exports = function createFotosAlunosPoseRouter(pool, authenticate, domainSchemaGuard, requireAlunoWhenStudent) {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (isAllowedImage(file)) cb(null, true);
      else cb(new Error('Apenas imagens são permitidas'), false);
    },
  });

  /**
   * POST /fotos-alunos/classify-pose
   * body: multipart file OU JSON { url } OU { foto_id }
   */
  router.post(
    '/fotos-alunos/classify-pose',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno', 'coach', 'admin']),
    requireAlunoWhenStudent(),
    progressPhotoPoseLimiter,
    (req, res, next) => {
      upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'A foto é grande demais (máx. 12 MB).',
            error_code: 'IMAGE_TOO_LARGE',
          });
        }
        // Sem file é ok (JSON com url/foto_id)
        if (err.message && /imagens/i.test(err.message) && !req.is('multipart/form-data')) {
          return next();
        }
        return res.status(400).json({
          error: err.message || 'Erro no upload',
          error_code: 'UPLOAD_FAILED',
        });
      });
    },
    async (req, res) => {
      try {
        let url = req.body?.url ? String(req.body.url).trim() : null;
        const fotoId = req.body?.foto_id ? String(req.body.foto_id).trim() : null;
        const persist = String(req.body?.persist || '') === '1' || req.body?.persist === true;

        if (fotoId) {
          if (!isValidUUID(fotoId)) {
            return res.status(400).json({ error: 'foto_id inválido', error_code: 'INVALID_UUID' });
          }
          const sel = await pool.query(
            `SELECT f.id, f.aluno_id, f.url, f.descricao, a.coach_id
             FROM public.fotos_alunos f
             LEFT JOIN public.alunos a ON a.id = f.aluno_id
             WHERE f.id = $1`,
            [fotoId],
          );
          if (!sel.rows.length) {
            return res.status(404).json({ error: 'Foto não encontrada', error_code: 'NOT_FOUND' });
          }
          const row = sel.rows[0];
          if (req.user.role === 'aluno' && req.aluno?.id !== row.aluno_id) {
            return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
          }
          if (req.user.role === 'coach') {
            const ok = await validateAlunoBelongsToCoach(pool, row.aluno_id, req.user.id);
            if (!ok) {
              return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
            }
          }
          url = row.url;
        }

        const result = await classifyProgressPhotoPose({
          imageBuffer: req.file?.buffer || null,
          url,
        });

        let saved = null;
        if (persist && fotoId && result.pose && result.pose !== 'incerto' && POSES.includes(result.pose)) {
          const upd = await pool.query(
            `UPDATE public.fotos_alunos SET descricao = $1 WHERE id = $2
             RETURNING id, descricao, url`,
            [result.pose, fotoId],
          );
          saved = upd.rows[0] || null;
        }

        return res.json({ ...result, saved });
      } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
          error: error.message || 'Erro ao classificar ângulo',
          error_code: error.error_code || 'POSE_CLASSIFY_FAILED',
        });
      }
    },
  );

  /**
   * PATCH /fotos-alunos/:id/pose — grava ângulo manual ou confirmado
   */
  router.patch(
    '/fotos-alunos/:id/pose',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno', 'coach', 'admin']),
    requireAlunoWhenStudent(),
    async (req, res) => {
      try {
        const fotoId = req.params.id;
        if (!isValidUUID(String(fotoId))) {
          return res.status(400).json({ error: 'ID inválido', error_code: 'INVALID_UUID' });
        }
        const pose = String(req.body?.pose || '').trim().toLowerCase();
        if (!POSES.includes(pose)) {
          return res.status(400).json({
            error: `pose deve ser um de: ${POSES.join(', ')}`,
            error_code: 'INVALID_POSE',
          });
        }

        const sel = await pool.query(
          `SELECT f.id, f.aluno_id FROM public.fotos_alunos f WHERE f.id = $1`,
          [fotoId],
        );
        if (!sel.rows.length) {
          return res.status(404).json({ error: 'Foto não encontrada', error_code: 'NOT_FOUND' });
        }
        const row = sel.rows[0];
        if (req.user.role === 'aluno' && req.aluno?.id !== row.aluno_id) {
          return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
        }
        if (req.user.role === 'coach') {
          const ok = await validateAlunoBelongsToCoach(pool, row.aluno_id, req.user.id);
          if (!ok) {
            return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
          }
        }

        const upd = await pool.query(
          `UPDATE public.fotos_alunos SET descricao = $1 WHERE id = $2
           RETURNING id, aluno_id, url, descricao, created_at`,
          [pose, fotoId],
        );
        return res.json(upd.rows[0]);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao atualizar pose' });
      }
    },
  );

  return router;
};
