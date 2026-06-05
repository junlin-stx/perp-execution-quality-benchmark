module.exports = {
  apps: [
    {
      name: "perp-bench",
      cwd: __dirname,
      script: "npm",
      args: [
        "run",
        "run:benchmark",
        "--",
        "--collect-interval",
        "60",
        "--latest-export-interval",
        "60",
        "--history-export-interval",
        "300",
        "--concurrency",
        "4",
        "--publish-r2"
      ],
      autorestart: true,
      restart_delay: 5000,
      kill_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: "production"
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
