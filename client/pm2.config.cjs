module.exports = {
  apps: [
    {
      name: "client-dev",
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
    {
      name: "client-preview",
      script: "bun",
      args: "run preview",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
