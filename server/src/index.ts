import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(
    `alex-1883-test-38 server listening on http://${config.host}:${config.port}`
  );
});

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`Received ${signal}; shutting down server`);
  server.close((error) => {
    if (error) {
      console.error("Server shutdown failed", error);
      process.exitCode = 1;
    }

    process.exit();
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
