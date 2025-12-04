module.exports = {
  name: "api-generic-be-app",
  script: "src/server.ts",
  instances: 1, // Bun doesn't support PM2 cluster mode - use 1 instance only
  exec_mode: "fork", // Use fork mode with Bun (not cluster)
  interpreter: "bun",
  env: {
    NODE_ENV: "production",
  },
  env_development: {
    NODE_ENV: "development",
  },
};