// PM2 config — Yangi Choy Next.js (apps/web)
// Ishga tushirish: pm2 start deploy/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "yangi-choy",
      cwd: "/var/www/yangi-choy/apps/web/.next/standalone/apps/web",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production", PORT: "3000", HOSTNAME: "127.0.0.1" },
    },
  ],
};
