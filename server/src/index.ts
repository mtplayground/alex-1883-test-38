import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./db/client.js";

const logError = (message: string, error: unknown) => {
  console.error(message, {
    name: error instanceof Error ? error.name : undefined,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
};

const startServer = async () => {
  try {
    await connectDatabase();

    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
      console.log(
        `alex-1883-test-38 server listening on http://${config.host}:${config.port}`
      );
    });

    const shutdown = (signal: NodeJS.Signals) => {
      console.log(`Received ${signal}; shutting down server`);
      server.close((error) => {
        void disconnectDatabase()
          .catch((disconnectError: unknown) => {
            logError("Database disconnect failed", disconnectError);
            process.exitCode = 1;
          })
          .finally(() => {
            if (error) {
              logError("Server shutdown failed", error);
              process.exitCode = 1;
            }

            process.exit();
          });
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logError("Server startup failed", error);
    process.exit(1);
  }
};

void startServer();
