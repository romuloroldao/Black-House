// ============================================================================
// ROTAS DE UPLOAD DE ARQUIVOS (/api/uploads/*)
// ============================================================================
// DESIGN-VPS-ONLY-CANONICAL-DATA-AND-STORAGE-002
// Upload de arquivos gerenciado pelo backend (sem Supabase Storage)
// ============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

module.exports = function(pool, authenticate) {
    
    // Configurar storage para avatares
    const avatarStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadsDir = path.join(__dirname, '..', 'storage', 'avatars');
            fs.mkdirSync(uploadsDir, { recursive: true });
            cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
            const userId = req.user.id;
            const fileExt = path.extname(file.originalname);
            const fileName = `${userId}-${Date.now()}${fileExt}`;
            cb(null, fileName);
        }
    });
    
    const uploadAvatar = multer({
        storage: avatarStorage,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB
        },
        fileFilter: (req, file, cb) => {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Apenas imagens são permitidas (JPEG, PNG, WebP)'), false);
            }
        }
    });
    
    // POST /api/uploads/avatar - Upload de avatar
    router.post('/avatar', authenticate, uploadAvatar.single('avatar'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }
            
            const userId = req.user.id;
            const fileName = req.file.filename;
            const filePath = `/storage/avatars/${fileName}`;
            
            // URL pública (pode ser ajustada para CDN no futuro)
            const publicUrl = `${process.env.API_URL || 'http://localhost:3001'}${filePath}`;
            
            // Atualizar avatar_url no profile
            await pool.query(
                `INSERT INTO public.profiles (id, avatar_url, updated_at)
                 VALUES ($1, $2, now())
                 ON CONFLICT (id) 
                 DO UPDATE SET avatar_url = $2, updated_at = now()`,
                [userId, publicUrl]
            );
            
            // Se for aluno, atualizar também no aluno (se existir)
            const alunoResult = await pool.query(
                'SELECT id FROM public.alunos WHERE linked_user_id = $1',
                [userId]
            );
            
            if (alunoResult.rows.length > 0) {
                // Avatar do aluno pode ser armazenado em outra tabela ou campo
                // Por enquanto, apenas retornamos o URL para o frontend atualizar
            }
            
            res.json({
                success: true,
                url: publicUrl,
                path: filePath,
                message: 'Avatar atualizado com sucesso'
            });
        } catch (error) {
            console.error('Erro no upload de avatar:', error);
            res.status(500).json({ error: error.message || 'Erro ao fazer upload do avatar' });
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
            const filePath = path.join(__dirname, '..', 'storage', 'avatars', req.params.filename);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Arquivo não encontrado' });
            }
            
            res.sendFile(filePath);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    return router;
};
