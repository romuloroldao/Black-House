// Centralized Error Handler
// Tratamento centralizado de erros com sanitização

class AppError extends Error {
    constructor(message, statusCode = 500, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
    // CORS-02: CORS é tratado EXCLUSIVAMENTE pelo gateway Nginx
    // Não adicionar headers CORS aqui para evitar duplicação
    // Gateway já adiciona headers CORS em todas as respostas (incluindo erros)
    // Log do erro
    const logger = req.app.get('logger');
    if (logger) {
        logger.error('Error occurred', {
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            path: req.path,
            method: req.method,
            userId: req.user?.id,
            ip: req.ip
        });
    } else {
        console.error('Error:', {
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            path: req.path,
            method: req.method
        });
    }

    // Determinar status code
    const statusCode = err.statusCode || 500;
    
    // Sanitizar mensagem de erro em produção
    let message = err.message;
    if (process.env.NODE_ENV === 'production') {
        // Não expor detalhes de erros internos
        if (statusCode === 500 && !err.isOperational) {
            message = 'Erro interno do servidor';
        }
    }

    // Resposta de erro
    const response = {
        success: false,
        error: message
    };

    // Adicionar código de erro se disponível
    if (err.code) {
        response.code = err.code;
    }

    // Adicionar stack trace apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
    const err = new AppError(`Rota não encontrada: ${req.method} ${req.path}`, 404, 'NOT_FOUND');
    next(err);
}

/**
 * Async handler wrapper para capturar erros
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    AppError,
    errorHandler,
    notFoundHandler,
    asyncHandler
};
