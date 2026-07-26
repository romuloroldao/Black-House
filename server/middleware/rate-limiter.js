// Rate Limiter Middleware
// Proteção contra brute force e DDoS

const rateLimit = require('express-rate-limit');

// Rate limiter para endpoints de autenticação
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 15, // 15 tentativas (era 5 — bloqueava alunos com typos)
    message: {
        error: 'Muitas tentativas. Tente novamente em alguns minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Não contar requisições bem-sucedidas
    skip: (req) => {
        // Pular rate limit em desenvolvimento
        return process.env.NODE_ENV === 'development';
    }
});

// Rate limiter para API geral
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW) || 60 * 1000, // 1 minuto
    max: parseInt(process.env.RATE_LIMIT_API_MAX) || 100, // 100 requisições
    message: {
        error: 'Muitas requisições. Tente novamente em alguns segundos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return process.env.NODE_ENV === 'development';
    }
});

// Rate limiter para webhooks (mais restritivo)
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: parseInt(process.env.RATE_LIMIT_WEBHOOK_MAX) || 10, // 10 requisições
    message: {
        error: 'Muitas requisições de webhook.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit por IP para webhooks
        return req.ip || req.connection.remoteAddress;
    }
});

// Rate limiter para upload de arquivos
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX) || 10, // 10 uploads
    message: {
        error: 'Limite de uploads excedido. Tente novamente mais tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Pedidos "esqueci minha senha" (por IP)
const forgotPasswordLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_FORGOT_WINDOW_MS) || 60 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_FORGOT_MAX) || 8,
    message: {
        error: 'Muitos pedidos de recuperação de senha. Tente novamente mais tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development'
});

// Submissões de nova senha com token (por IP)
const resetPasswordSubmitLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_RESET_SUBMIT_WINDOW_MS) || 60 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_RESET_SUBMIT_MAX) || 20,
    message: {
        error: 'Muitas tentativas de redefinição. Tente novamente mais tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development'
});

// Análise de foto de refeição (custo de IA) — por utilizador autenticado
const mealPhotoAnalyzeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_MEAL_PHOTO_WINDOW_MS) || 60 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MEAL_PHOTO_MAX) || 10,
    message: {
        error: 'Limite de análises de refeição atingido. Tente novamente mais tarde.',
        error_code: 'MEAL_PHOTO_RATE_LIMIT',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.id || req.ip || req.connection?.remoteAddress || 'anon';
    },
    skip: (req) => process.env.NODE_ENV === 'development',
});

// Intent do agente (aluno) — por utilizador autenticado
const agentIntentLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AGENT_WINDOW_MS) || 60 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_AGENT_MAX) || 30,
    message: {
        error: 'Limite de pedidos ao assistente atingido. Usa os atalhos do Hoje ou tenta mais tarde.',
        error_code: 'AGENT_RATE_LIMIT',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.id || req.ip || req.connection?.remoteAddress || 'anon';
    },
    skip: (req) => process.env.NODE_ENV === 'development',
});

module.exports = {
    authLimiter,
    apiLimiter,
    webhookLimiter,
    uploadLimiter,
    forgotPasswordLimiter,
    resetPasswordSubmitLimiter,
    mealPhotoAnalyzeLimiter,
    agentIntentLimiter,
};
