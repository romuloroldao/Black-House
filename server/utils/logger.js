// Structured Logger
// Logging estruturado com Winston

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Criar diretório de logs se não existir
const logDir = process.env.LOG_DIR || '/var/log/blackhouse-api';
if (!fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
        console.warn('Não foi possível criar diretório de logs:', error.message);
    }
}

// Formato JSON para produção
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Formato legível para desenvolvimento
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Configurar transports
const transports = [];

// Console transport (sempre ativo)
transports.push(
    new winston.transports.Console({
        format: process.env.LOG_FORMAT === 'json' ? jsonFormat : consoleFormat,
        level: process.env.LOG_LEVEL || 'info'
    })
);

// File transport (apenas em produção)
if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE) {
    transports.push(
        new winston.transports.File({
            filename: process.env.LOG_FILE,
            format: jsonFormat,
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    );

    // Error log separado
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            format: jsonFormat,
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    );
}

// Criar logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: jsonFormat,
    defaultMeta: {
        service: 'blackhouse-api',
        environment: process.env.NODE_ENV || 'development'
    },
    transports,
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log')
        })
    ]
});

// Helper para log de requisições HTTP
logger.logRequest = (req, res, responseTime) => {
    const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    if (req.user) {
        logData.userId = req.user.id;
    }

    if (res.statusCode >= 400) {
        logger.warn('HTTP Request', logData);
    } else {
        logger.info('HTTP Request', logData);
    }
};

// Helper para log de WebSocket
logger.logWebSocket = (event, data) => {
    logger.info('WebSocket Event', {
        event,
        ...data
    });
};

// Helper para log de Jobs
logger.logJob = (jobName, status, data = {}) => {
    const logData = {
        job: jobName,
        status,
        ...data
    };

    if (status === 'error') {
        logger.error('Background Job', logData);
    } else {
        logger.info('Background Job', logData);
    }
};

module.exports = logger;
