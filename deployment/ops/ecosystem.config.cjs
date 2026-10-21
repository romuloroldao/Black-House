/**
 * PM2 ecosystem — produção Black House
 * Uso: pm2 start /opt/blackhouse/ops/ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'blackhouse-api',
      script: '/root/server/index.js',
      cwd: '/root/server',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      min_uptime: '10s',
      max_restarts: 15,
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
