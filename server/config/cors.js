// ============================================================================
// CONFIGURAÇÃO ÚNICA DE CORS - CORS-SINGLE-SOURCE-OF-TRUTH-001
// ============================================================================
// Single source of truth para CORS
// Nunca setar CORS em múltiplas camadas
// ============================================================================

module.exports = {
    origin: function (origin, callback) {
        // Permitir requisições sem origin (mobile apps, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }
        
        // Lista de origens permitidas
        const allowedOrigins = [
            'https://blackhouse.app.br',
            'https://www.blackhouse.app.br',
            'http://localhost:5173', // Dev
            'http://localhost:3000'  // Dev alternativo
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false,
    maxAge: 86400 // 24 horas
};
