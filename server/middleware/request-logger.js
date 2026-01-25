// Request Logger Middleware
// Log de todas as requisições HTTP

const logger = require('../utils/logger');

function requestLogger(req, res, next) {
    const startTime = Date.now();

    // Log quando resposta terminar
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        logger.logRequest(req, res, responseTime);
    });

    next();
}

module.exports = requestLogger;
