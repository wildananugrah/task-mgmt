module.exports = {
  apps: [
    {
      name: "task-mgmt-fe-app",
      script: "bun",
      args: "run dev",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
