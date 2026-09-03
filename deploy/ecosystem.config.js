// PM2 Process Manager Configuration for SIH26162
module.exports = {
  apps: [
    {
      name: "sih26162-api",
      script: "/home/ubuntu/SIH26162/.venv/bin/python3",
      args: "-m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000 --workers 2",
      cwd: "/home/ubuntu/SIH26162",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        PYTHONPATH: "/home/ubuntu/SIH26162",
        ENVIRONMENT: "production",
      },
    },
    {
      name: "sih26162-web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/home/ubuntu/SIH26162/apps/web",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
