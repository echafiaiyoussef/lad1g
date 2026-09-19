module.exports = {
  apps: [
    {
      name: 'laundry-app',
      script: 'dist/server.cjs',
      instances: 1, // Single instance required for WhatsApp Baileys socket state
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/pm2-err.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
