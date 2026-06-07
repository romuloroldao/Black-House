// ============================================================================
// ROTAS DE UPLOAD DE ARQUIVOS (/api/uploads/*)
// ============================================================================
// Upload de arquivos gerenciado pelo backend
// ============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { queryAlunoRowsFullForUser } = require('../utils/aluno-resolve-by-user');
const { isValidUUID } = require('../utils/uuid-validator');
const {
    normalizeUploadImage,
    imageNormalizeErrorMessage,
} = require('../utils/normalize-upload-image');
const router = express.Router();

module.exports = function(pool, authenticate) {
    function resolvePublicBaseUrl(req) {
        const envBase = (process.env.API_URL || '').trim().replace(/\/$/, '');
        if (envBase) return envBase;
        const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString().split(',')[0].trim();
        const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString().split(',')[0].trim();
        if (host) return `${proto}://${host}`.replace(/\/$/, '');
        return 'https://api.blackhouse.app.br';
    }
    
    const uploadAvatar = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 12 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (isAllowedProgressImage(file)) {
                cb(null, true);
            } else {
                cb(new Error('Apenas imagens são permitidas'), false);
            }
        },
    });
    
    // POST /api/uploads/avatar - Upload de avatar
    router.post('/avatar', authenticate, uploadAvatar.single('avatar'), async (req, res) => {
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const userId = req.user.id;
            const normalized = await normalizeUploadImage(req.file.buffer);
            const uploadsDir = path.join(__dirname, '..', 'storage', 'avatars');
            fs.mkdirSync(uploadsDir, { recursive: true });
            const fileName = `${userId}-${Date.now()}${normalized.ext}`;
            fs.writeFileSync(path.join(uploadsDir, fileName), normalized.buffer);

            // Caminho canónico (router montado em /api/uploads — ver api.js)
            const relPath = `/api/uploads/storage/avatars/${fileName}`;
            const publicUrl = `${resolvePublicBaseUrl(req)}${relPath}`;
            
            // Atualizar avatar_url no profile
            await pool.query(
                `INSERT INTO public.profiles (id, avatar_url, updated_at)
                 VALUES ($1, $2, now())
                 ON CONFLICT (id) 
                 DO UPDATE SET avatar_url = $2, updated_at = now()`,
                [userId, publicUrl]
            );
            
            // Se for aluno, manter compatibilidade com schema antigo/novo
            // (com ou sem coluna linked_user_id).
            const alunoRows = await queryAlunoRowsFullForUser(pool, userId);
            if (alunoRows.length > 0) {
                // Avatar do aluno pode ser armazenado em outra tabela ou campo
                // Por enquanto, apenas retornamos o URL para o frontend atualizar
            }
            
            res.json({
                success: true,
                url: publicUrl,
                path: relPath,
                message: 'Avatar atualizado com sucesso'
            });
        } catch (error) {
            console.error('Erro no upload de avatar:', error);
            if (error.message === 'IMAGE_TOO_LARGE' || error.message === 'EMPTY_IMAGE') {
                return res.status(400).json({ error: imageNormalizeErrorMessage(error) });
            }
            res.status(500).json({ error: imageNormalizeErrorMessage(error) });
        }
    });
    
    // GET /api/uploads/avatar/:userId - Buscar avatar do usuário
    router.get('/avatar/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            
            const result = await pool.query(
                'SELECT avatar_url FROM public.profiles WHERE id = $1',
                [userId]
            );
            
            if (result.rows.length === 0 || !result.rows[0].avatar_url) {
                return res.status(404).json({ error: 'Avatar não encontrado' });
            }
            
            res.json({ url: result.rows[0].avatar_url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    // GET /storage/avatars/:filename - Servir arquivo de avatar
    router.get('/storage/avatars/:filename', (req, res) => {
        try {
            // Evita bloqueio `NotSameOrigin` ao carregar <img> de api.* em app.*.
            res.set('Cross-Origin-Resource-Policy', 'cross-origin');
            const safeName = path.basename(String(req.params.filename || ''));
            if (!safeName) {
                return res.status(400).json({ error: 'Parâmetros inválidos' });
            }
            const avatarsDir = path.resolve(__dirname, '..', 'storage', 'avatars');
            const filePath = path.resolve(avatarsDir, safeName);
            if (!filePath.startsWith(avatarsDir)) {
                return res.status(400).json({ error: 'Parâmetros inválidos' });
            }
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Arquivo não encontrado' });
            }
            res.sendFile(filePath);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    function isAllowedProgressImage(file) {
        const allowedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
            'application/octet-stream',
        ];
        const mime = String(file.mimetype || '').toLowerCase();
        if (allowedTypes.includes(mime) || mime.startsWith('image/')) {
            return true;
        }
        const ext = path.extname(file.originalname || '').toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(ext);
    }

    const uploadProgress = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 12 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (isAllowedProgressImage(file)) {
                cb(null, true);
            } else {
                cb(new Error('Apenas imagens são permitidas (JPEG, PNG, WebP)'), false);
            }
        },
    });

    // POST /api/uploads/progress-photo — fotos de evolução (substitui Supabase storage progress-photos)
    router.post('/progress-photo', authenticate, (req, res, next) => {
        uploadProgress.single('file')(req, res, (multerErr) => {
            if (!multerErr) return next();
            if (multerErr.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'A foto é grande demais (máx. 12 MB). Tente outra imagem.',
                    error_code: 'IMAGE_TOO_LARGE',
                });
            }
            return res.status(400).json({
                error: multerErr.message || 'Erro no upload da foto',
                error_code: 'UPLOAD_FAILED',
            });
        });
    }, async (req, res) => {
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }
            const rows = await queryAlunoRowsFullForUser(pool, req.user.id);
            if (!rows.length) {
                return res.status(403).json({ error: 'Aluno não vinculado', error_code: 'ALUNO_NOT_LINKED' });
            }
            const alunoId = rows[0].id;
            const normalized = await normalizeUploadImage(req.file.buffer);
            const destName = `${Date.now()}${normalized.ext}`;
            const destDir = path.join(__dirname, '..', 'storage', 'progress-photos', String(alunoId));
            fs.mkdirSync(destDir, { recursive: true });
            const destPath = path.join(destDir, destName);
            fs.writeFileSync(destPath, normalized.buffer);

            const base = resolvePublicBaseUrl(req);
            const relPath = `/api/uploads/storage/progress-photos/${alunoId}/${destName}`;
            const publicUrl = `${base}${relPath}`;

            return res.status(201).json({
                success: true,
                url: publicUrl,
                path: relPath,
            });
        } catch (error) {
            console.error('Erro no upload de progresso:', error);
            if (error.message === 'IMAGE_TOO_LARGE' || error.message === 'EMPTY_IMAGE') {
                return res.status(400).json({ error: imageNormalizeErrorMessage(error) });
            }
            return res.status(500).json({ error: imageNormalizeErrorMessage(error) });
        }
    });

    router.get('/storage/progress-photos/:alunoId/:filename', (req, res) => {
        try {
            // Evita bloqueio `NotSameOrigin` ao carregar <img> de api.* em app.*.
            res.set('Cross-Origin-Resource-Policy', 'cross-origin');
            const { alunoId, filename } = req.params;
            if (!isValidUUID(alunoId)) {
                return res.status(400).json({ error: 'Parâmetros inválidos' });
            }
            const safeName = path.basename(filename);
            const filePath = path.join(__dirname, '..', 'storage', 'progress-photos', alunoId, safeName);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Arquivo não encontrado' });
            }
            return res.sendFile(filePath);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    const uploadEducationalPdf = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 25 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const mime = String(file.mimetype || '').toLowerCase();
            const ext = path.extname(file.originalname || '').toLowerCase();
            if (mime === 'application/pdf' || ext === '.pdf') {
                cb(null, true);
            } else {
                cb(new Error('Apenas arquivos PDF são permitidos'), false);
            }
        },
    });

    // POST /api/uploads/educational-pdf — PDF da biblioteca educativa (coach/admin)
    router.post('/educational-pdf', authenticate, uploadEducationalPdf.single('file'), async (req, res) => {
        try {
            if (req.user?.role !== 'coach' && req.user?.role !== 'admin') {
                return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
            }
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            const coachId = req.user.id;
            const safeBase = path.basename(String(req.file.originalname || 'documento.pdf'))
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .slice(0, 120) || 'documento.pdf';
            const destName = `${Date.now()}-${safeBase.endsWith('.pdf') ? safeBase : `${safeBase}.pdf`}`;
            const destDir = path.join(__dirname, '..', 'storage', 'educational-contents', String(coachId));
            fs.mkdirSync(destDir, { recursive: true });
            fs.writeFileSync(path.join(destDir, destName), req.file.buffer);

            const base = resolvePublicBaseUrl(req);
            const relPath = `/api/uploads/storage/educational-contents/${coachId}/${destName}`;
            const publicUrl = `${base}${relPath}`;

            return res.status(201).json({
                success: true,
                url: publicUrl,
                path: relPath,
            });
        } catch (error) {
            console.error('Erro no upload de PDF educativo:', error);
            return res.status(500).json({ error: error.message || 'Erro no upload' });
        }
    });

    router.get('/storage/educational-contents/:coachId/:filename', authenticate, (req, res) => {
        try {
            res.set('Cross-Origin-Resource-Policy', 'cross-origin');
            const { coachId, filename } = req.params;
            if (!isValidUUID(coachId)) {
                return res.status(400).json({ error: 'Parâmetros inválidos' });
            }

            const role = req.user?.role;
            if (role === 'coach' || role === 'admin') {
                if (req.user.id !== coachId && role !== 'admin') {
                    return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
                }
            } else if (role === 'aluno') {
                // Aluno: permitido se o PDF pertence ao coach e está ligado à dieta activa
                // (validação completa feita na rota GET /api/educational-contents/:id)
            } else {
                return res.status(403).json({ error: 'Sem permissão', error_code: 'FORBIDDEN' });
            }

            const safeName = path.basename(filename);
            const dir = path.resolve(__dirname, '..', 'storage', 'educational-contents', coachId);
            const filePath = path.resolve(dir, safeName);
            if (!filePath.startsWith(dir)) {
                return res.status(400).json({ error: 'Parâmetros inválidos' });
            }
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Arquivo não encontrado' });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
            return res.sendFile(filePath);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    return router;
};
