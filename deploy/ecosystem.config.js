module.exports = {
  apps: [
    {
      name: "sih26162-api",
      script: "/var/www/sih/venv/bin/python3",
      args: "-m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000 --workers 2",
      cwd: "/var/www/sih",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env: {
        PYTHONPATH: "/var/www/sih",
        PYTHONIOENCODING: "utf-8",
        ENVIRONMENT: "production",
      },
    },
    {
      name: "sih26162-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      cwd: "/var/www/sih/apps/web",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        NEXT_PUBLIC_API_URL: "/api/v1",
        NEXT_PUBLIC_WS_URL: "",
      },
    },
  ],
};
