/**
 * Rotas: refeições registadas (diário alimentar do aluno)
 * /api/refeicoes-registradas/*
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const validateRole = require('../middleware/validateRole');
const { validateUUIDParam } = require('../utils/uuid-validator');
const { queryAlunoRowsFullForUser } = require('../utils/aluno-resolve-by-user');
const {
  resolveCoachScope,
  assertCoachCanAccessAluno,
} = require('../services/coach-team.service');
const mealService = require('../services/refeicoes-registradas.service');
const { analyzeMealPhoto } = require('../services/meal-photo-ai.service');
const { mealPhotoAnalyzeLimiter } = require('../middleware/rate-limiter');
const {
  normalizeUploadImage,
  imageNormalizeErrorMessage,
} = require('../utils/normalize-upload-image');

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

module.exports = function createRefeicoesRegistradasRouter(pool, authenticate, domainSchemaGuard) {
  const router = express.Router();

  const uploadAnalyze = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (isAllowedImage(file)) cb(null, true);
      else cb(new Error('Apenas imagens são permitidas'), false);
    },
  });

  async function resolveAlunoIdForUser(userId) {
    const rows = await queryAlunoRowsFullForUser(pool, userId);
    return rows[0]?.id || null;
  }

  // GET /api/refeicoes-registradas — lista do aluno autenticado
  router.get(
    '/',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    async (req, res) => {
      try {
        const alunoId = await resolveAlunoIdForUser(req.user.id);
        if (!alunoId) {
          return res.status(403).json({ error: 'Aluno não vinculado', error_code: 'ALUNO_NOT_LINKED' });
        }
        const rows = await mealService.listForAluno(pool, alunoId, {
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.json(rows);
      } catch (error) {
        console.error('GET /refeicoes-registradas', error);
        return res.status(500).json({ error: error.message });
      }
    },
  );

  // POST /api/refeicoes-registradas/analyze — antes de /:id
  router.post(
    '/analyze',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    mealPhotoAnalyzeLimiter,
    (req, res, next) => {
      uploadAnalyze.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'A foto é grande demais (máx. 12 MB).',
            error_code: 'IMAGE_TOO_LARGE',
          });
        }
        return res.status(400).json({
          error: err.message || 'Erro no upload',
          error_code: 'UPLOAD_FAILED',
        });
      });
    },
    async (req, res) => {
      try {
        const alunoId = await resolveAlunoIdForUser(req.user.id);
        if (!alunoId) {
          return res.status(403).json({ error: 'Aluno não vinculado', error_code: 'ALUNO_NOT_LINKED' });
        }

        let imagemPath = req.body?.imagem_path ? String(req.body.imagem_path).trim() : null;
        let imageBuffer = req.file?.buffer || null;

        if (imageBuffer) {
          const normalized = await normalizeUploadImage(imageBuffer, {
            maxSide: 1600,
            maxBytes: 3 * 1024 * 1024,
            quality: 78,
          });
          const destName = `${Date.now()}${normalized.ext}`;
          const destDir = path.join(__dirname, '..', 'storage', 'meal-photos', String(alunoId));
          fs.mkdirSync(destDir, { recursive: true });
          fs.writeFileSync(path.join(destDir, destName), normalized.buffer);
          imagemPath = `/api/uploads/storage/meal-photos/${alunoId}/${destName}`;
          imageBuffer = normalized.buffer;
        }

        if (!imageBuffer && !imagemPath) {
          return res.status(400).json({
            error: 'Envie uma imagem (file) ou imagem_path',
            error_code: 'EMPTY_IMAGE',
          });
        }

        const analysis = await analyzeMealPhoto({
          imageBuffer,
          imagemPath,
          alunoId,
        });

        return res.json({
          ...analysis,
          imagem_path: imagemPath,
          disclaimer:
            analysis.disclaimer ||
            'Estimativa aproximada. Valores estimados — revise as porções antes de salvar.',
        });
      } catch (error) {
        if (error.message === 'IMAGE_TOO_LARGE' || error.message === 'EMPTY_IMAGE') {
          return res.status(400).json({
            error: imageNormalizeErrorMessage(error),
            error_code: error.message,
          });
        }
        const status = error.statusCode || 500;
        return res.status(status).json({
          error: error.message || 'Erro ao analisar refeição',
          error_code: error.error_code || 'ANALYZE_FAILED',
        });
      }
    },
  );

  // POST /api/refeicoes-registradas — salvar
  router.post(
    '/',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno']),
    async (req, res) => {
      try {
        const alunoId = await resolveAlunoIdForUser(req.user.id);
        if (!alunoId) {
          return res.status(403).json({ error: 'Aluno não vinculado', error_code: 'ALUNO_NOT_LINKED' });
        }
        const created = await mealService.createMeal(pool, alunoId, req.body || {});
        return res.status(201).json(created);
      } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
          error: error.message || 'Erro ao salvar refeição',
          error_code: error.error_code || 'SAVE_FAILED',
        });
      }
    },
  );

  // GET /api/refeicoes-registradas/:id
  router.get(
    '/:id',
    authenticate,
    domainSchemaGuard,
    validateRole(['aluno', 'coach', 'admin', 'assistant']),
    validateUUIDParam('id'),
    async (req, res) => {
      try {
        const repo = require('../repositories/refeicoes-registradas.repository');
        const row = await repo.getById(pool, req.params.id);
        if (!row) {
          return res.status(404).json({ error: 'Refeição não encontrada', error_code: 'NOT_FOUND' });
        }
        const itens = await repo.listItens(pool, row.id);
        const full = { ...row, itens };

        if (req.user.role === 'aluno') {
          const alunoId = await resolveAlunoIdForUser(req.user.id);
          if (!alunoId || row.aluno_id !== alunoId) {
            return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
          }
          return res.json(full);
        }

        const scope = await resolveCoachScope(pool, req.user.id, req.user.role);
        const ok = await assertCoachCanAccessAluno(pool, scope, row.aluno_id);
        if (!ok) {
          return res.status(403).json({ error: 'Acesso negado', error_code: 'FORBIDDEN' });
        }
        return res.json(full);
      } catch (error) {
        console.error('GET /refeicoes-registradas/:id', error);
        return res.status(500).json({ error: error.message });
      }
    },
  );

  return router;
};
