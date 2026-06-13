// PM2 config — Yangi Choy Next.js (apps/web)
// Ishga tushirish: pm2 start deploy/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "yangi-choy",
      cwd: "/var/www/yangi-choy/apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production", PORT: "3000" },
    },
  ],
};
