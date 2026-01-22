// Rate Limiter Middleware
// Proteção contra brute force e DDoS

const rateLimit = require('express-rate-limit');

// Rate limiter para endpoints de autenticação
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 5, // 5 tentativas
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

module.exports = {
    authLimiter,
    apiLimiter,
    webhookLimiter,
    uploadLimiter
};
