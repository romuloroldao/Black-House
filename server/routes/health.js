// Health Check Routes
// Endpoints para monitoramento e health checks

const express = require('express');
const router = express.Router();

class HealthController {
    constructor(pool, websocketService, jobsRunner, app) {
        this.pool = pool;
        this.websocketService = websocketService;
        this.jobsRunner = jobsRunner;
        this.app = app; // Para acessar schemaValid e schemaError
    }

    /**
     * Health check básico
     * AUTH-HARDENING-001: Incluir status de schema
     */
    async basic(req, res) {
        const schemaValid = this.app?.get('schemaValid')?.() ?? false;
        const schemaError = this.app?.get('schemaError')?.() ?? null;
        
        const status = schemaValid ? 'ok' : 'degraded';
        const statusCode = schemaValid ? 200 : 503;
        
        const response = {
            status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        };
        
        if (!schemaValid && schemaError) {
            response.schema = {
                valid: false,
                error: 'Schema inválido',
                message: schemaError.message,
                action_required: 'Aplicar migração SQL necessária'
            };
        } else if (schemaValid) {
            response.schema = {
                valid: true
            };
        }
        
        res.status(statusCode).json(response);
    }

    /**
     * Health check detalhado
     */
    async detailed(req, res) {
        const checks = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            checks: {}
        };

        // AUTH-HARDENING-001: Check schema validity
        const schemaValid = this.app?.get('schemaValid')?.() ?? false;
        const schemaError = this.app?.get('schemaError')?.() ?? null;
        
        if (!schemaValid) {
            checks.status = 'degraded';
            checks.checks.schema = {
                status: 'invalid',
                reason: 'SCHEMA_INVALID',
                error: schemaError?.message || 'Schema validation failed',
                missing_columns: schemaError?.message?.includes('linked_user_id') ? ['public.alunos.linked_user_id'] : undefined,
                action_required: 'Apply SQL migration'
            };
        } else {
            checks.checks.schema = {
                status: 'ok',
                valid: true
            };
        }

        // Check database
        try {
            const dbResult = await this.pool.query('SELECT NOW() as now');
            checks.checks.database = {
                status: 'ok',
                responseTime: Date.now() - Date.now(), // Simplificado
                connected: true
            };
        } catch (error) {
            if (checks.status === 'ok') checks.status = 'degraded';
            checks.checks.database = {
                status: 'error',
                error: error.message
            };
        }

        // Check WebSocket
        if (this.websocketService) {
            const io = this.websocketService.getIO();
            checks.checks.websocket = {
                status: 'ok',
                connectedClients: io.sockets.sockets.size
            };
        } else {
            checks.checks.websocket = {
                status: 'disabled'
            };
        }

        // Check Jobs
        if (this.jobsRunner) {
            checks.checks.jobs = {
                status: 'ok',
                activeJobs: this.jobsRunner.jobs?.length || 0
            };
        } else {
            checks.checks.jobs = {
                status: 'disabled'
            };
        }

        // Check memory
        const memUsage = process.memoryUsage();
        checks.checks.memory = {
            status: 'ok',
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
        };

        // CORS-SINGLE-SOURCE-OF-TRUTH-001: Status de CORS no healthcheck
        checks.checks.cors = {
            status: 'ok',
            origin: 'https://blackhouse.app.br',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
        };

        const statusCode = checks.status === 'ok' ? 200 : 503;
        res.status(statusCode).json(checks);
    }

    /**
     * Readiness check (Kubernetes/Docker)
     */
    async ready(req, res) {
        try {
            // Verificar se banco está acessível
            await this.pool.query('SELECT 1');
            
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(503).json({
                status: 'not ready',
                error: 'Database not accessible',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Liveness check (Kubernetes/Docker)
     */
    async live(req, res) {
        res.json({
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    }
}

/**
 * Factory function para criar router de health
 */
function createHealthRouter(pool, websocketService, jobsRunner, app) {
    const router = express.Router();
    const controller = new HealthController(pool, websocketService, jobsRunner, app);

    router.get('/', (req, res) => controller.basic(req, res));
    router.get('/detailed', (req, res) => controller.detailed(req, res));
    router.get('/ready', (req, res) => controller.ready(req, res));
    router.get('/live', (req, res) => controller.live(req, res));

    return router;
}

module.exports = createHealthRouter;
