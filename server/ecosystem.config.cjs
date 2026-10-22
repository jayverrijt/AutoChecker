module.exports = {
  apps: [
    {
      name: 'vrijcheck-server',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        SERVER_API_KEY: 'REDACTED_API_KEY'
      }
    }
  ]
};
