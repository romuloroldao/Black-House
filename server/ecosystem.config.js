// DESIGN-AUTH-API-HARDENING-AVAILABILITY-002: Configuração PM2 com auto-restart
// Garante que a API reinicia automaticamente em caso de crash

module.exports = {
    apps: [{
        name: 'blackhouse-api',
        script: './index.js',
        cwd: '/root/server',
        instances: 1,
        exec_mode: 'fork',
        
        // DESIGN-AUTH-API-HARDENING-AVAILABILITY-002: Auto-restart configurado
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s',
        max_memory_restart: '500M',
        
        // Logs
        error_file: '/root/.pm2/logs/blackhouse-api-error.log',
        out_file: '/root/.pm2/logs/blackhouse-api-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        
        // Variáveis de ambiente
        env: {
            NODE_ENV: 'production',
            PORT: process.env.PORT || 3001,
        },
        
        // Watch (opcional - desabilitado em produção)
        watch: false,
        
        // Ignore watch
        ignore_watch: ['node_modules', 'logs', '.git'],
        
        // Graceful shutdown
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 10000,
        
        // Restart delay
        restart_delay: 4000,
        
        // Exp backoff restart delay
        exp_backoff_restart_delay: 100,
    }]
};
