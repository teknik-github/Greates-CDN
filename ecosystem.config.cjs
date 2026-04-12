module.exports = {
  apps: [
    {
      name: 'greates-cdn',
      cwd: __dirname,
      script: './scripts/start.mjs',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
}
