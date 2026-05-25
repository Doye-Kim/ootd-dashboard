module.exports = {
  apps: [
    {
      name: 'ootd',
      script: 'node_modules/.bin/next',
      args: 'start',
      interpreter: '/opt/homebrew/bin/node',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '.env.local',
      restart_delay: 3000,
      max_restarts: 5,
    },
  ],
};
