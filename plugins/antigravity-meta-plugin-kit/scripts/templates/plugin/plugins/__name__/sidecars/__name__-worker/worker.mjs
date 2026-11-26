#!/usr/bin/env node
// Minimal background sidecar stub for {{name}}.
// Replace with your long-running server, watcher, or event producer.
console.error("[{{name}}-worker] started");
const timer = setInterval(() => {}, 60_000);
const shutdown = () => {
  clearInterval(timer);
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
