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
const { classifyProgressPhotoPose } = require('../services/progress-photo-pose.service');
const engine = require('../services/foto-pose.engine');
const poseResolver = require('../services/foto-pose-resolver');
const normalization = require('../services/foto-pose-normalization.service');
const { validateAlunoBelongsToCoach } = require('../utils/identity-resolver');

const COMPARABLE_POSES = engine.COMPARABLE_POSES;
const ALL_POSES = engine.ALL_POSES;

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
            `SELECT f.id, f.aluno_id, f.url, f.descricao, f.pose_coach, a.coach_id
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

          if (persist && (await poseResolver.hasPoseMetadataColumns(pool))) {
            const saved = await normalization.classifyAndPersistPhoto(pool, row);
            return res.json({
              pose: saved?.pose_efetiva || saved?.pose_vision,
              confidence: saved?.pose_vision_confidence,
              reason: saved?.pose_vision_reason,
              source: saved?.pose_source || 'vision',
              saved,
            });
          }
          url = row.url;
        }

        const result = await classifyProgressPhotoPose({
          imageBuffer: req.file?.buffer || null,
          url,
        });

        let saved = null;
        if (persist && fotoId && COMPARABLE_POSES.includes(result.pose)) {
          const patch = engine.buildPoseRecordFromVision(result, {});
          saved = await poseResolver.applyEffectivePoseUpdate(pool, fotoId, patch);
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

  router.patch(
    '/fotos-alunos/:id/pose',
    authenticate,
    domainSchemaGuard,
    validateRole(['coach', 'admin']),
    async (req, res) => {
      try {
        const fotoId = req.params.id;
        if (!isValidUUID(String(fotoId))) {
          return res.status(400).json({ error: 'ID inválido', error_code: 'INVALID_UUID' });
        }
        const pose = String(req.body?.pose || '').trim().toLowerCase();
        if (!ALL_POSES.includes(pose)) {
          return res.status(400).json({
            error: `pose deve ser um de: ${ALL_POSES.join(', ')}`,
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
        if (req.user.role === 'coach') {
          const ok = await validateAlunoBelongsToCoach(pool, row.aluno_id, req.user.id);
          if (!ok) {
            return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
          }
        }

        const saved = await poseResolver.setCoachPose(pool, fotoId, pose);
        return res.json(saved);
      } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message || 'Erro ao atualizar pose' });
      }
    },
  );

  router.post(
    '/admin/fotos-alunos/reprocess-pose',
    authenticate,
    domainSchemaGuard,
    validateRole(['admin', 'coach']),
    async (req, res) => {
      try {
        const limit = Math.min(Number(req.body?.limit) || normalization.BATCH_LIMIT, 20);
        const alunoId = req.body?.aluno_id ? String(req.body.aluno_id).trim() : null;
        const resetFailed =
          String(req.body?.reset_failed || '') === 'true' || req.body?.reset_failed === true;
        if (alunoId && !isValidUUID(alunoId)) {
          return res.status(400).json({ error: 'aluno_id inválido', error_code: 'INVALID_UUID' });
        }
        if (req.user.role === 'coach' && alunoId) {
          const ok = await validateAlunoBelongsToCoach(pool, alunoId, req.user.id);
          if (!ok) {
            return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
          }
        }
        let resetResult = { reset: 0 };
        if (resetFailed) {
          resetResult = await normalization.resetFailedPhotos(pool, { alunoId });
        } else if (alunoId) {
          await pool.query(
            `UPDATE public.fotos_alunos
             SET pose_analysis_status = 'pending', pose_analysis_attempts = 0
             WHERE aluno_id = $1 AND pose_coach IS NULL
               AND pose_analysis_status IN ('failed', 'classified')`,
            [alunoId],
          );
        }
        const result = await normalization.processBatch(pool);
        return res.json({
          ...result,
          reset: resetResult.reset,
          metrics: normalization.getMetrics(),
          inventory: await normalization.getInventory(pool),
        });
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Erro ao reprocessar poses' });
      }
    },
  );

  return router;
};
