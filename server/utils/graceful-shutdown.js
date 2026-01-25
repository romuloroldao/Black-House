// Graceful Shutdown Handler
// Fecha conexões e finaliza processos de forma segura

const logger = require('./logger');

class GracefulShutdown {
    constructor(httpServer, pool, websocketService, jobsRunner) {
        this.httpServer = httpServer;
        this.pool = pool;
        this.websocketService = websocketService;
        this.jobsRunner = jobsRunner;
        this.isShuttingDown = false;
    }

    /**
     * Inicializa handlers de shutdown
     */
    setup() {
        // SIGTERM (Docker, systemd)
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        
        // SIGINT (Ctrl+C)
        process.on('SIGINT', () => this.shutdown('SIGINT'));

        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
            this.shutdown('uncaughtException');
        });

        // Unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection', { reason, promise });
            this.shutdown('unhandledRejection');
        });
    }

    /**
     * Executa shutdown graceful
     */
    async shutdown(signal) {
        if (this.isShuttingDown) {
            logger.warn('Shutdown já em andamento, forçando saída...');
            process.exit(1);
        }

        this.isShuttingDown = true;
        logger.info(`Iniciando shutdown graceful (${signal})...`);

        const shutdownTimeout = setTimeout(() => {
            logger.error('Shutdown timeout, forçando saída...');
            process.exit(1);
        }, 30000); // 30 segundos timeout

        try {
            // 1. Parar de aceitar novas conexões
            logger.info('Fechando servidor HTTP...');
            this.httpServer.close(() => {
                logger.info('Servidor HTTP fechado');
            });

            // 2. Fechar WebSocket
            if (this.websocketService) {
                logger.info('Fechando WebSocket...');
                const io = this.websocketService.getIO();
                io.close(() => {
                    logger.info('WebSocket fechado');
                });
            }

            // 3. Parar jobs
            if (this.jobsRunner) {
                logger.info('Parando background jobs...');
                this.jobsRunner.stop();
            }

            // 4. Fechar conexões do banco
            logger.info('Fechando conexões do banco de dados...');
            await this.pool.end();
            logger.info('Conexões do banco fechadas');

            clearTimeout(shutdownTimeout);
            logger.info('Shutdown completo');
            process.exit(0);
        } catch (error) {
            logger.error('Erro durante shutdown', { error: error.message, stack: error.stack });
            clearTimeout(shutdownTimeout);
            process.exit(1);
        }
    }
}

module.exports = GracefulShutdown;
