// ============================================================================
// ROTAS CANÔNICAS DE UPLOAD (/api/uploads/*)
// ============================================================================
// VPS-BACKEND-CANONICAL-ARCH-001
// Uploads controlados via filesystem
// Tabela uploads como única fonte de verdade
// ============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

module.exports = function(pool, authenticate) {
    
    // ============================================================================
    // CONFIGURAÇÃO: Multer para avatares
    // ============================================================================
    // accept: image/png, image/jpeg
    // maxSize: 2MB
    // path: /uploads/avatars/{user_id}.png
    // overwrite: true
    // ============================================================================
    
    const avatarStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadsDir = path.join('/var/www/blackhouse/uploads', 'avatars');
            fs.mkdirSync(uploadsDir, { recursive: true });
            cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
            const userId = req.user.id;
            // Sempre sobrescrever: {user_id}.png
            const fileExt = path.extname(file.originalname) || '.png';
            const fileName = `${userId}${fileExt}`;
            cb(null, fileName);
        }
    });
    
    const uploadAvatar = multer({
        storage: avatarStorage,
        limits: {
            fileSize: 2 * 1024 * 1024 // 2MB
        },
        fileFilter: (req, file, cb) => {
            const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg'];
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Apenas imagens PNG e JPEG são permitidas'), false);
            }
        }
    });
    
    // ============================================================================
    // ENDPOINT: POST /api/uploads/avatar
    // ============================================================================
    // Flow:
    // 1. Valida auth
    // 2. Valida mime-type
    // 3. Salva no filesystem
    // 4. Atualiza tabela uploads
    // 5. Retorna avatar_url
    // ============================================================================
    
    router.post('/avatar', authenticate, uploadAvatar.single('avatar'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'Nenhum arquivo enviado',
                    error_code: 'NO_FILE'
                });
            }
            
            const userId = req.user.id;
            const fileName = req.file.filename;
            const filePath = `/uploads/avatars/${fileName}`;
            const fullPath = req.file.path;
            
            // Verificar permissões do arquivo (0644)
            fs.chmodSync(fullPath, 0o644);
            
            // Atualizar tabela uploads (sobrescrever se existir)
            const uploadResult = await pool.query(
                `INSERT INTO public.uploads (
                    owner_user_id,
                    type,
                    path,
                    mime_type,
                    size_bytes
                 ) VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (owner_user_id, type) 
                 DO UPDATE SET 
                    path = $3,
                    mime_type = $4,
                    size_bytes = $5,
                    created_at = now()
                 RETURNING *`,
                [userId, 'avatar', filePath, req.file.mimetype, req.file.size]
            );
            
            // URL pública
            const avatarUrl = `${process.env.API_URL || 'http://localhost:3001'}${filePath}`;
            
            res.json({
                success: true,
                avatar_url: avatarUrl,
                path: filePath,
                upload: uploadResult.rows[0]
            });
        } catch (error) {
            console.error('Erro no upload de avatar:', error);
            
            // Limpar arquivo se houver erro
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.status(500).json({
                error: error.message || 'Erro ao fazer upload do avatar',
                error_code: 'UPLOAD_ERROR'
            });
        }
    });
    
    // ============================================================================
    // ENDPOINT: GET /api/uploads/avatar
    // ============================================================================
    // Retorna avatar_url do usuário autenticado
    // ============================================================================
    
    router.get('/avatar', authenticate, async (req, res) => {
        try {
            const userId = req.user.id;
            
            const uploadResult = await pool.query(
                `SELECT path, mime_type, size_bytes, created_at
                 FROM public.uploads
                 WHERE owner_user_id = $1 AND type = 'avatar'
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [userId]
            );
            
            if (uploadResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Avatar não encontrado',
                    error_code: 'AVATAR_NOT_FOUND'
                });
            }
            
            const upload = uploadResult.rows[0];
            const avatarUrl = `${process.env.API_URL || 'http://localhost:3001'}${upload.path}`;
            
            res.json({
                avatar_url: avatarUrl,
                path: upload.path,
                mime_type: upload.mime_type,
                size_bytes: upload.size_bytes
            });
        } catch (error) {
            console.error('Erro ao buscar avatar:', error);
            res.status(500).json({
                error: 'Erro ao buscar avatar',
                error_code: 'AVATAR_FETCH_ERROR'
            });
        }
    });
    
    // ============================================================================
    // ENDPOINT: GET /uploads/avatars/:filename
    // ============================================================================
    // Servir arquivo de avatar (público)
    // ============================================================================
    
    router.get('/avatars/:filename', (req, res) => {
        try {
            const { filename } = req.params;
            
            // Prevenir path traversal
            if (filename.includes('..') || filename.includes('/')) {
                return res.status(400).json({
                    error: 'Nome de arquivo inválido',
                    error_code: 'INVALID_FILENAME'
                });
            }
            
            const filePath = path.join('/var/www/blackhouse/uploads', 'avatars', filename);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'Avatar não encontrado',
                    error_code: 'AVATAR_NOT_FOUND'
                });
            }
            
            // Verificar que é um arquivo (não diretório)
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                return res.status(400).json({
                    error: 'Caminho inválido',
                    error_code: 'INVALID_PATH'
                });
            }
            
            // Servir arquivo
            res.sendFile(filePath);
        } catch (error) {
            console.error('Erro ao servir avatar:', error);
            res.status(500).json({
                error: 'Erro ao servir avatar',
                error_code: 'AVATAR_SERVE_ERROR'
            });
        }
    });
    
    return router;
};
