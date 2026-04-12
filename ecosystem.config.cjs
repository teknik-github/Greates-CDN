module.exports = {
  apps: [
    {
      name: 'greates-cdn',
      cwd: __dirname,
      script: '.output/server/index.mjs',
      interpreter: 'node',
      interpreter_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        NITRO_HOST: '0.0.0.0',
        NITRO_PORT: 3001,
      },
    },
  ],
}
